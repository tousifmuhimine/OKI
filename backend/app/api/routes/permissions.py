from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import PermissionGrant
from app.schemas.common import PaginationMeta
from app.schemas.permission import PermissionGrantCreate, PermissionGrantListResponse, PermissionGrantOut, PermissionGrantUpdate, PermissionPresetApply, PermissionPresetResponse


router = APIRouter()

ROLE_PERMISSION_PRESETS: dict[str, list[str]] = {
    "admin": [
        "customers.manage",
        "leads.manage",
        "tasks.manage",
        "analytics.view",
        "chat.manage",
        "ai.settings",
        "permissions.manage",
    ],
    "supervisor": [
        "customers.manage",
        "leads.manage",
        "tasks.manage",
        "analytics.view",
        "chat.manage",
    ],
    "agent": [
        "customers.view",
        "leads.view",
        "tasks.manage",
        "chat.manage",
    ],
}


@router.post("/presets", response_model=PermissionPresetResponse, status_code=status.HTTP_201_CREATED)
async def apply_permission_preset(
    payload: PermissionPresetApply,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> PermissionPresetResponse:
    permissions = ROLE_PERMISSION_PRESETS.get(payload.role.lower())
    if not permissions:
        raise HTTPException(status_code=400, detail="Unsupported permission preset")

    for permission_key in permissions:
        existing = (
            await session.execute(
                select(PermissionGrant).where(
                    PermissionGrant.workspace_id == auth.user_id,
                    PermissionGrant.user_id == payload.user_id,
                    PermissionGrant.permission_key == permission_key,
                )
            )
        ).scalar_one_or_none()
        if existing:
            existing.is_allowed = True
        else:
            session.add(
                PermissionGrant(
                    workspace_id=auth.user_id,
                    user_id=payload.user_id,
                    permission_key=permission_key,
                    is_allowed=True,
                )
            )

    await session.commit()
    return PermissionPresetResponse(role=payload.role.lower(), permissions=permissions)


@router.get("", response_model=PermissionGrantListResponse)
async def list_permission_grants(
    user_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> PermissionGrantListResponse:
    query = select(PermissionGrant).where(PermissionGrant.workspace_id == auth.user_id)
    count_query = select(func.count(PermissionGrant.id)).where(PermissionGrant.workspace_id == auth.user_id)

    if user_id:
        query = query.where(PermissionGrant.user_id == user_id)
        count_query = count_query.where(PermissionGrant.user_id == user_id)

    query = query.order_by(PermissionGrant.created_at.desc()).limit(limit).offset(offset)
    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return PermissionGrantListResponse(
        data=[PermissionGrantOut.model_validate(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=PermissionGrantOut, status_code=status.HTTP_201_CREATED)
async def create_permission_grant(
    payload: PermissionGrantCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> PermissionGrantOut:
    existing = (
        await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.workspace_id == auth.user_id,
                PermissionGrant.user_id == payload.user_id,
                PermissionGrant.permission_key == payload.permission_key,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.is_allowed = payload.is_allowed
        await session.commit()
        await session.refresh(existing)
        return PermissionGrantOut.model_validate(existing)

    grant = PermissionGrant(
        workspace_id=auth.user_id,
        user_id=payload.user_id,
        permission_key=payload.permission_key,
        is_allowed=payload.is_allowed,
    )
    session.add(grant)
    await session.commit()
    await session.refresh(grant)
    return PermissionGrantOut.model_validate(grant)


@router.patch("/{grant_id}", response_model=PermissionGrantOut)
async def update_permission_grant(
    grant_id: str,
    payload: PermissionGrantUpdate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> PermissionGrantOut:
    grant = await session.get(PermissionGrant, grant_id)
    if not grant or grant.workspace_id != auth.user_id:
        raise HTTPException(status_code=404, detail="Permission grant not found")
    grant.is_allowed = payload.is_allowed
    await session.commit()
    await session.refresh(grant)
    return PermissionGrantOut.model_validate(grant)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission_grant(
    grant_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    grant = await session.get(PermissionGrant, grant_id)
    if not grant or grant.workspace_id != auth.user_id:
        raise HTTPException(status_code=404, detail="Permission grant not found")
    await session.delete(grant)
    await session.commit()