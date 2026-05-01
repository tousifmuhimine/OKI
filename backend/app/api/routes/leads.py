from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Contact, Conversation, Customer, Inbox, Lead
from app.services.lead_capture import upsert_lead_from_inbound_message
from app.schemas.common import PaginationMeta
from app.schemas.customer import CustomerOut
from app.schemas.lead import LeadAnalyticsSummary, LeadCreate, LeadListResponse, LeadOut, LeadUpdate


router = APIRouter()


LEAD_STATUSES = {"new", "contacted", "qualified", "proposal", "won", "lost"}


async def _get_lead_or_404(lead_id: str, session: AsyncSession) -> Lead:
    lead = await session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


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


@router.get("/analytics/summary", response_model=LeadAnalyticsSummary)
async def get_lead_analytics_summary(
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadAnalyticsSummary:
    total = (await session.execute(select(func.count(Lead.id)))).scalar_one()
    converted = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.converted_customer_id.is_not(None))
        )
    ).scalar_one()

    status_rows = (
        await session.execute(select(Lead.status, func.count(Lead.id)).group_by(Lead.status))
    ).all()
    source_rows = (
        await session.execute(select(Lead.source, func.count(Lead.id)).group_by(Lead.source))
    ).all()

    return LeadAnalyticsSummary(
        total=total,
        by_status={status_name or "unknown": count for status_name, count in status_rows},
        by_source={source_name or "unsourced": count for source_name, count in source_rows},
        converted=converted,
        conversion_rate=round((converted / total) * 100, 1) if total else 0,
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


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    lead = await _get_lead_or_404(lead_id, session)
    return LeadOut.model_validate(lead)


@router.get("/from-conversation/{conversation_id}", response_model=LeadOut)
async def get_lead_from_conversation(
    conversation_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    lead = (
        await session.execute(
            select(Lead)
            .where(Lead.conversation_id == conversation_id)
            .order_by(Lead.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found for conversation")
    return LeadOut.model_validate(lead)


@router.post("/from-conversation/{conversation_id}", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead_from_conversation(
    conversation_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    conversation = await session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    contact = await session.get(Contact, conversation.contact_id)
    inbox = await session.get(Inbox, conversation.inbox_id)
    if not contact or not inbox:
        raise HTTPException(status_code=404, detail="Conversation contact or inbox not found")

    lead = await upsert_lead_from_inbound_message(
        session,
        inbox=inbox,
        contact=contact,
        conversation=conversation,
        channel_type=conversation.channel_type,
        capture_source="manual",
    )
    await session.commit()
    await session.refresh(lead)
    return LeadOut.model_validate(lead)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    lead = await _get_lead_or_404(lead_id, session)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") and changes["status"] not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported lead status")

    for key, value in changes.items():
        setattr(lead, key, value)

    await session.commit()
    await session.refresh(lead)
    return LeadOut.model_validate(lead)


@router.post("/{lead_id}/convert", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def convert_lead(
    lead_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    lead = await _get_lead_or_404(lead_id, session)
    if lead.converted_customer_id:
        customer = await session.get(Customer, lead.converted_customer_id)
        if customer:
            return CustomerOut.model_validate(customer)

    customer = Customer(
        company_name=lead.company_name,
        contact_person=lead.contact_person,
        assigned_user_id=lead.assigned_user_id or auth.user_id,
        stage="new",
        group_name=lead.source,
        tags={"lead_id": lead.id, "lead_source": lead.source},
        notes=f"Converted from lead {lead.id}. Source: {lead.source or 'unsourced'}.",
    )
    session.add(customer)
    await session.flush()

    lead.converted_customer_id = customer.id
    lead.status = "won"

    await session.commit()
    await session.refresh(customer)
    return CustomerOut.model_validate(customer)
