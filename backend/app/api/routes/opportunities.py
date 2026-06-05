from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Opportunity
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityListResponse,
    OpportunityOut,
    OpportunityUpdate,
    PipelineOut,
    PipelineStageOut,
)
from app.schemas.common import PaginationMeta

router = APIRouter()


@router.get("/pipeline", response_model=PipelineOut)
async def get_pipeline(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> Any:
    from app.db.models import Pipeline, PipelineStage, Organization, OrganizationType
    stmt = select(Pipeline).where(Pipeline.organization_id == auth.org_id, Pipeline.is_active.is_(True))
    pipeline = (await session.execute(stmt)).scalars().first()

    if not pipeline:
        org = await session.get(Organization, auth.org_id)
        industry_code = "real_estate"
        if org and org.organization_type_id:
            org_type = await session.get(OrganizationType, org.organization_type_id)
            if org_type:
                industry_code = org_type.code

        from app.services.industry_seeder import seed_organization_defaults
        await seed_organization_defaults(session, auth.org_id, industry_code)
        await session.commit()

        # Re-fetch pipeline
        pipeline = (await session.execute(stmt)).scalars().first()
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline configuration not found")

    stages_stmt = select(PipelineStage).where(PipelineStage.pipeline_id == pipeline.id).order_by(PipelineStage.position.asc())
    stages = (await session.execute(stages_stmt)).scalars().all()

    return {
        "id": pipeline.id,
        "name": pipeline.name,
        "stages": [PipelineStageOut.model_validate(s) for s in stages]
    }


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Any:
    stmt = (
        select(Opportunity)
        .where(Opportunity.organization_id == auth.org_id)
        .order_by(Opportunity.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    opportunities = result.scalars().all()

    count_stmt = (
        select(func.count(Opportunity.id))
        .where(Opportunity.organization_id == auth.org_id)
    )
    count_result = await session.execute(count_stmt)
    total = count_result.scalar_one()

    return OpportunityListResponse(
        data=[OpportunityOut.model_validate(o) for o in opportunities],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opportunity_in: OpportunityCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> Any:
    opportunity = Opportunity(
        **opportunity_in.model_dump(),
        organization_id=auth.org_id,
        branch_id=auth.branch_id,
    )
    session.add(opportunity)
    await session.commit()
    await session.refresh(opportunity)
    return opportunity


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
async def update_opportunity(
    opportunity_id: str,
    opportunity_in: OpportunityUpdate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> Any:
    opportunity = await session.get(Opportunity, opportunity_id)
    if not opportunity or opportunity.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    update_data = opportunity_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(opportunity, field, value)

    await session.commit()
    await session.refresh(opportunity)
    return opportunity
