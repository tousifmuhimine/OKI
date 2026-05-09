from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep, has_permission
from app.core.config import settings
from app.db.models import PermissionGrant, Task


router = APIRouter()


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=32)


class AdminUserOut(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


class AdminUserDetail(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None
    role: str | None = None
    created_at: str | None = None
    permissions: list[str] = []
    task_count: int = 0


class AdminUserListResponse(BaseModel):
    data: list[AdminUserDetail]
    total: int = 0


class PermissionsSummaryItem(BaseModel):
    user_id: str
    permissions: list[str] = []


class TasksSummaryItem(BaseModel):
    assigned_user_id: str
    count: int = 0
    pending: int = 0
    done: int = 0


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    payload: AdminUserCreate,
    auth: AuthContext = Depends(get_current_auth),
    session=Depends(get_session_dep),
) -> AdminUserOut:
    if not await has_permission(session, auth.user_id, auth.user_id, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase admin credentials are not configured")

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    body = {
        "email": payload.email,
        "password": payload.password,
        "email_confirm": True,
        "user_metadata": {
            "name": payload.full_name,
            "role": payload.role,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, headers=headers, json=body)

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    return AdminUserOut(
        id=str(data.get("id") or data.get("user", {}).get("id")),
        email=data.get("email") or data.get("user", {}).get("email"),
        role=payload.role,
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_admin_users(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> AdminUserListResponse:
    """List users from Supabase Auth and enrich with permissions + task counts."""
    if not await has_permission(session, auth.user_id, auth.user_id, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Fetch from Supabase Admin API
    users: list[AdminUserDetail] = []
    if settings.supabase_url and settings.supabase_service_role_key:
        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code < 400:
                supa_users = resp.json().get("users", [])
                for u in supa_users:
                    meta = u.get("user_metadata") or {}
                    users.append(AdminUserDetail(
                        id=u.get("id", ""),
                        email=u.get("email"),
                        name=meta.get("name"),
                        role=meta.get("role"),
                        created_at=u.get("created_at"),
                    ))
        except Exception:
            pass  # fallback to empty

    # Get all permission grants for workspace
    perm_rows = (
        await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.workspace_id == auth.user_id,
                PermissionGrant.is_allowed == True,
            )
        )
    ).scalars().all()

    # Group permissions by user_id
    perms_by_user: dict[str, list[str]] = {}
    for p in perm_rows:
        perms_by_user.setdefault(p.user_id, []).append(p.permission_key)

    # Get task counts by assigned_user_id
    task_counts = (
        await session.execute(
            select(Task.assigned_user_id, func.count(Task.id).label("cnt"))
            .group_by(Task.assigned_user_id)
        )
    ).all()
    task_count_map: dict[str, int] = {row.assigned_user_id: row.cnt for row in task_counts if row.assigned_user_id}

    # Enrich users with permissions + task counts
    for user in users:
        user.permissions = perms_by_user.get(user.id, [])
        user.task_count = task_count_map.get(user.id, 0)

    # Also include any permission users not returned by Supabase (e.g. dev users)
    known_ids = {u.id for u in users}
    for p in perm_rows:
        if p.user_id not in known_ids:
            users.append(AdminUserDetail(
                id=p.user_id,
                email=None,
                name=p.user_id[:12],
                permissions=perms_by_user.get(p.user_id, []),
                task_count=task_count_map.get(p.user_id, 0),
            ))
            known_ids.add(p.user_id)

    return AdminUserListResponse(data=users, total=len(users))


@router.get("/users/permissions-summary", response_model=list[PermissionsSummaryItem])
async def permissions_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[PermissionsSummaryItem]:
    """Return each user and their list of permission grants for the workspace."""
    rows = (
        await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.workspace_id == auth.user_id,
                PermissionGrant.is_allowed == True,
            )
        )
    ).scalars().all()

    grouped: dict[str, list[str]] = {}
    for r in rows:
        grouped.setdefault(r.user_id, []).append(r.permission_key)

    return [PermissionsSummaryItem(user_id=uid, permissions=perms) for uid, perms in grouped.items()]


@router.get("/users/tasks-summary", response_model=list[TasksSummaryItem])
async def tasks_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[TasksSummaryItem]:
    """Return task counts per assigned user."""
    all_tasks = (await session.execute(select(Task))).scalars().all()
    from collections import defaultdict
    count_map: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "pending": 0, "done": 0})
    for t in all_tasks:
        if not t.assigned_user_id:
            continue
        count_map[t.assigned_user_id]["count"] += 1
        if t.status == "done":
            count_map[t.assigned_user_id]["done"] += 1
        elif t.status == "pending":
            count_map[t.assigned_user_id]["pending"] += 1

    return [
        TasksSummaryItem(
            assigned_user_id=uid,
            count=v["count"],
            pending=v["pending"],
            done=v["done"],
        )
        for uid, v in count_map.items()
    ]