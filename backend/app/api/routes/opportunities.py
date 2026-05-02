from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Opportunity
from app.db.session import get_db_session
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityListResponse,
    OpportunityOut,
    OpportunityUpdate,
)
from app.schemas.common import PaginationMeta

router = APIRouter()


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    session: AsyncSession = Depends(get_db_session),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Any:
    stmt = select(Opportunity).order_by(Opportunity.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    opportunities = result.scalars().all()

    count_stmt = select(func.count(Opportunity.id))
    count_result = await session.execute(count_stmt)
    total = count_result.scalar_one()

    return OpportunityListResponse(
        data=[OpportunityOut.model_validate(o) for o in opportunities],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opportunity_in: OpportunityCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    opportunity = Opportunity(**opportunity_in.model_dump())
    session.add(opportunity)
    await session.commit()
    await session.refresh(opportunity)
    return opportunity


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
async def update_opportunity(
    opportunity_id: str,
    opportunity_in: OpportunityUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    opportunity = await session.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    update_data = opportunity_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(opportunity, field, value)

    await session.commit()
    await session.refresh(opportunity)
    return opportunity
