from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.api.deps import has_permission
from app.db.models import Conversation, Customer, CustomerPreference, Lead
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerOut, CustomerProfileResponse, CustomerUpdate, CustomerLeadIntelligence, CustomerPreferenceOut
from app.schemas.lead import LeadOut
from app.schemas.common import PaginationMeta


router = APIRouter()


async def _can_view_customers(auth: AuthContext, session: AsyncSession) -> bool:
    return auth.role == "super_admin" or await has_permission(session, auth.user_id, auth, "customers.view") or await has_permission(session, auth.user_id, auth, "customers.manage")


async def _populate_customer_assignments(customer_obj: Customer, session: AsyncSession) -> list[str]:
    from app.db.models import Assignment
    res = await session.execute(select(Assignment.user_id).where(Assignment.customer_id == customer_obj.id))
    return list(res.scalars().all())


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    stage: str | None = None,
    country_region: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerListResponse:
    if not await _can_view_customers(auth, session):
        raise HTTPException(status_code=403, detail="Permission denied")

    query = select(Customer)
    count_query = select(func.count(Customer.id))

    from app.api.deps import apply_tenant_filters
    query = apply_tenant_filters(query, auth, Customer)
    count_query = apply_tenant_filters(count_query, auth, Customer)

    if stage:
        query = query.where(Customer.stage == stage)
        count_query = count_query.where(Customer.stage == stage)
    if country_region:
        query = query.where(Customer.country_region == country_region)
        count_query = count_query.where(Customer.country_region == country_region)
    if search:
        needle = f"%{search}%"
        condition = or_(
            Customer.company_name.ilike(needle),
            Customer.contact_person.ilike(needle),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    query = query.order_by(Customer.updated_at.desc()).limit(limit).offset(offset)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    data_out = []
    for r in rows:
        c_out = CustomerOut.model_validate(r)
        c_out.assigned_user_ids = await _populate_customer_assignments(r, session)
        data_out.append(c_out)

    return CustomerListResponse(
        data=data_out,
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    if not await has_permission(session, auth.user_id, auth, "customers.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    data = payload.model_dump()
    data["organization_id"] = auth.org_id
    data["branch_id"] = auth.branch_id
    assigned_user_ids = data.pop("assigned_user_ids", None)
    
    entity = Customer(**data)

    session.add(entity)
    await session.flush()

    if assigned_user_ids:
        from app.db.models import Assignment
        for uid in assigned_user_ids:
            session.add(Assignment(
                organization_id=auth.org_id,
                customer_id=entity.id,
                user_id=uid,
                assigned_by_id=auth.user_id
            ))
            
    await session.commit()
    await session.refresh(entity)
    c_out = CustomerOut.model_validate(entity)
    c_out.assigned_user_ids = await _populate_customer_assignments(entity, session)
    return c_out


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")
    if entity.organization_id and entity.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check hierarchy and assigned permission
    from app.api.deps import apply_tenant_filters
    stmt = apply_tenant_filters(select(Customer).where(Customer.id == customer_id), auth, Customer)
    res = await session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")
    c_out = CustomerOut.model_validate(entity)
    c_out.assigned_user_ids = await _populate_customer_assignments(entity, session)
    return c_out


@router.get("/{customer_id}/profile", response_model=CustomerProfileResponse)
async def get_customer_profile(
    customer_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerProfileResponse:
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")
    if entity.organization_id and entity.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    from app.api.deps import apply_tenant_filters
    stmt = apply_tenant_filters(select(Customer).where(Customer.id == customer_id), auth, Customer)
    res = await session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    leads = (
        await session.execute(
            select(Lead)
            .where(Lead.converted_customer_id == customer_id)
            .order_by(Lead.updated_at.desc())
        )
    ).scalars().all()

    lead_intelligence = [
        CustomerLeadIntelligence(
            lead_id=lead.id,
            intent=lead.intent,
            engagement=lead.engagement,
            trust_level=lead.trust_level,
            budget_min=float(lead.budget_min) if lead.budget_min is not None else None,
            budget_max=float(lead.budget_max) if lead.budget_max is not None else None,
            last_summary=lead.last_summary,
            updated_at=lead.updated_at,
        )
        for lead in leads
    ]

    preference_rows = (
        await session.execute(
            select(CustomerPreference)
            .where(CustomerPreference.customer_id == customer_id)
            .order_by(CustomerPreference.detected_at.desc())
            .limit(20)
        )
    ).scalars().all()

    conversation_count = (
        await session.execute(
            select(func.count(Conversation.id)).where(
                Conversation.contact_id.in_(
                    select(Lead.contact_id).where(Lead.converted_customer_id == customer_id, Lead.contact_id.is_not(None))
                )
            )
        )
    ).scalar_one()

    latest_lead = leads[0] if leads else None

    c_out = CustomerOut.model_validate(entity)
    c_out.assigned_user_ids = await _populate_customer_assignments(entity, session)

    return CustomerProfileResponse(
        customer=c_out,
        related_leads=[LeadOut.model_validate(lead) for lead in leads],
        lead_intelligence=lead_intelligence,
        preference_history=[
            CustomerPreferenceOut(
                field_name=row.field_name,
                old_value=row.old_value,
                new_value=row.new_value,
                detected_from=row.detected_from,
                confidence=float(row.confidence or 0),
                detected_at=row.detected_at,
            )
            for row in preference_rows
        ],
        conversation_count=conversation_count,
        ai_summary=latest_lead.last_summary if latest_lead else None,
        trust_level=latest_lead.trust_level if latest_lead else None,
    )


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    if auth.role != "super_admin" and not await has_permission(session, auth.user_id, auth, "customers.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")
    if entity.organization_id and entity.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    from app.api.deps import apply_tenant_filters
    stmt = apply_tenant_filters(select(Customer).where(Customer.id == customer_id), auth, Customer)
    res = await session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    changes = payload.model_dump(exclude_unset=True)
    assigned_user_ids = changes.pop("assigned_user_ids", None)

    for key, value in changes.items():
        setattr(entity, key, value)

    if assigned_user_ids is not None:
        from app.db.models import Assignment
        from sqlalchemy import delete
        await session.execute(delete(Assignment).where(Assignment.customer_id == entity.id))
        for uid in assigned_user_ids:
            session.add(Assignment(
                organization_id=auth.org_id,
                customer_id=entity.id,
                user_id=uid,
                assigned_by_id=auth.user_id
            ))

    await session.commit()
    await session.refresh(entity)
    c_out = CustomerOut.model_validate(entity)
    c_out.assigned_user_ids = await _populate_customer_assignments(entity, session)
    return c_out


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    if auth.role != "super_admin" and not await has_permission(session, auth.user_id, auth, "customers.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")
    if entity.organization_id and entity.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Customer not found")
    from app.api.deps import apply_tenant_filters
    stmt = apply_tenant_filters(select(Customer).where(Customer.id == customer_id), auth, Customer)
    res = await session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    await session.delete(entity)
    await session.commit()
