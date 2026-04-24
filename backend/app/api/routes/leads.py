from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Lead
from app.schemas.common import PaginationMeta
from app.schemas.lead import LeadCreate, LeadListResponse, LeadOut


router = APIRouter()


@router.get("", response_model=LeadListResponse)
async def list_leads(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadListResponse:
    query = select(Lead)
    count_query = select(func.count(Lead.id))

    if status_filter:
        query = query.where(Lead.status == status_filter)
        count_query = count_query.where(Lead.status == status_filter)

    query = query.order_by(Lead.updated_at.desc()).limit(limit).offset(offset)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return LeadListResponse(
        data=[LeadOut.model_validate(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    entity = Lead(**payload.model_dump())
    if not entity.assigned_user_id:
        entity.assigned_user_id = auth.user_id

    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return LeadOut.model_validate(entity)
