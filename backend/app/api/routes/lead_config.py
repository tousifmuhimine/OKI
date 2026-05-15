from typing import Any, Type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import LeadArea, LeadProfession, LeadSector, LeadSource, LeadStage
from app.schemas.lead import (
    LeadNamedConfigCreate,
    LeadNamedConfigOut,
    LeadNamedConfigUpdate,
    LeadSourceCreate,
    LeadSourceOut,
    LeadSourceUpdate,
    LeadStageCreate,
    LeadStageOut,
    LeadStageUpdate,
)

router = APIRouter()


ConfigModel = Type[LeadSource | LeadStage | LeadSector | LeadArea | LeadProfession]


async def _list_entities(
    model: ConfigModel,
    out_schema: Any,
    session: AsyncSession,
    active_only: bool,
) -> list[Any]:
    query = select(model)
    if active_only:
        query = query.where(model.is_active.is_(True))
    if model is LeadStage:
        query = query.order_by(LeadStage.position.asc(), LeadStage.name.asc())
    else:
        query = query.order_by(model.name.asc())
    rows = (await session.execute(query)).scalars().all()
    return [out_schema.model_validate(row) for row in rows]


async def _create_entity(model: ConfigModel, out_schema: Any, payload: Any, session: AsyncSession) -> Any:
    entity = model(**payload.model_dump())
    session.add(entity)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A configuration item with this name already exists") from exc
    await session.refresh(entity)
    return out_schema.model_validate(entity)


async def _update_entity(model: ConfigModel, out_schema: Any, item_id: str, payload: Any, session: AsyncSession) -> Any:
    entity = await session.get(model, item_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A configuration item with this name already exists") from exc
    await session.refresh(entity)
    return out_schema.model_validate(entity)


async def _delete_entity(model: ConfigModel, item_id: str, session: AsyncSession) -> None:
    entity = await session.get(model, item_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    entity.is_active = False
    await session.commit()


@router.get("/lead-sources", response_model=list[LeadSourceOut])
async def list_lead_sources(
    active_only: bool = Query(default=False),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[LeadSourceOut]:
    return await _list_entities(LeadSource, LeadSourceOut, session, active_only)


@router.post("/lead-sources", response_model=LeadSourceOut, status_code=status.HTTP_201_CREATED)
async def create_lead_source(
    payload: LeadSourceCreate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadSourceOut:
    return await _create_entity(LeadSource, LeadSourceOut, payload, session)


@router.patch("/lead-sources/{item_id}", response_model=LeadSourceOut)
async def update_lead_source(
    item_id: str,
    payload: LeadSourceUpdate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadSourceOut:
    return await _update_entity(LeadSource, LeadSourceOut, item_id, payload, session)


@router.delete("/lead-sources/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_source(
    item_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    await _delete_entity(LeadSource, item_id, session)


@router.get("/lead-stages", response_model=list[LeadStageOut])
async def list_lead_stages(
    active_only: bool = Query(default=False),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[LeadStageOut]:
    return await _list_entities(LeadStage, LeadStageOut, session, active_only)


@router.post("/lead-stages", response_model=LeadStageOut, status_code=status.HTTP_201_CREATED)
async def create_lead_stage(
    payload: LeadStageCreate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadStageOut:
    if payload.position == 0:
        max_position = (await session.execute(select(func.max(LeadStage.position)))).scalar_one_or_none() or 0
        payload.position = max_position + 1
    return await _create_entity(LeadStage, LeadStageOut, payload, session)


@router.patch("/lead-stages/{item_id}", response_model=LeadStageOut)
async def update_lead_stage(
    item_id: str,
    payload: LeadStageUpdate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadStageOut:
    return await _update_entity(LeadStage, LeadStageOut, item_id, payload, session)


@router.delete("/lead-stages/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_stage(
    item_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    await _delete_entity(LeadStage, item_id, session)


def _named_routes(path: str, model: ConfigModel):
    @router.get(path, response_model=list[LeadNamedConfigOut])
    async def list_items(
        active_only: bool = Query(default=False),
        _: AuthContext = Depends(get_current_auth),
        session: AsyncSession = Depends(get_session_dep),
    ) -> list[LeadNamedConfigOut]:
        return await _list_entities(model, LeadNamedConfigOut, session, active_only)

    @router.post(path, response_model=LeadNamedConfigOut, status_code=status.HTTP_201_CREATED)
    async def create_item(
        payload: LeadNamedConfigCreate,
        _: AuthContext = Depends(get_current_auth),
        session: AsyncSession = Depends(get_session_dep),
    ) -> LeadNamedConfigOut:
        return await _create_entity(model, LeadNamedConfigOut, payload, session)

    @router.patch(f"{path}/{{item_id}}", response_model=LeadNamedConfigOut)
    async def update_item(
        item_id: str,
        payload: LeadNamedConfigUpdate,
        _: AuthContext = Depends(get_current_auth),
        session: AsyncSession = Depends(get_session_dep),
    ) -> LeadNamedConfigOut:
        return await _update_entity(model, LeadNamedConfigOut, item_id, payload, session)

    @router.delete(f"{path}/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(
        item_id: str,
        _: AuthContext = Depends(get_current_auth),
        session: AsyncSession = Depends(get_session_dep),
    ) -> None:
        await _delete_entity(model, item_id, session)


_named_routes("/lead-sectors", LeadSector)
_named_routes("/lead-areas", LeadArea)
_named_routes("/lead-professions", LeadProfession)
