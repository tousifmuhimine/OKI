from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import UserLLMConfig, Contact, Conversation, Customer, Inbox, Lead, Opportunity, SalesOrder, Task, AuditLog
from app.inbox.security import decrypt_channel_config
from app.schemas.common import PaginationMeta
from app.schemas.customer import CustomerOut
from app.schemas.lead import LeadAnalyticsSummary, LeadCreate, LeadListResponse, LeadOut, LeadUpdate, LeadConvertPayload
from app.services.ai_convert import convert_notes_to_lead
from app.services.intelligence import evaluate_intelligence_alerts, record_preference_history, record_stage_history
from app.services.lead_capture import upsert_lead_from_inbound_message


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
    converted = (await session.execute(select(func.count(Lead.id)).where(Lead.converted_customer_id.is_not(None)))).scalar_one()

    status_rows = (await session.execute(select(Lead.status, func.count(Lead.id)).group_by(Lead.status))).all()
    source_rows = (await session.execute(select(Lead.source, func.count(Lead.id)).group_by(Lead.source))).all()

    return LeadAnalyticsSummary(
        total=total,
        by_status={status_name or "unknown": count for status_name, count in status_rows},
        by_source={source_name or "unsourced": count for source_name, count in source_rows},
        converted=converted,
        conversion_rate=round((converted / total) * 100, 1) if total else 0,
    )


class AIConvertPayload(BaseModel):
    raw_notes: str


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
    await session.flush()
    await record_preference_history(
        session,
        workspace_id=auth.user_id,
        lead=entity,
        text=" ".join(filter(None, [entity.notes, entity.raw_note, entity.company_name, entity.address, entity.industry])),
        detected_from="lead_create",
    )
    await session.commit()
    await session.refresh(entity)
    return LeadOut.model_validate(entity)


@router.post("/ai-convert", response_model=LeadCreate)
async def ai_convert_notes(
    payload: AIConvertPayload,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadCreate:
    api_key = None
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == auth.user_id,
        UserLLMConfig.provider == "groq",
    )
    res = await session.execute(q)
    config_record = res.scalar_one_or_none()

    if config_record and config_record.encrypted_config:
        try:
            decrypted = decrypt_channel_config(config_record.encrypted_config)
            api_key = decrypted.get("api_key")
        except Exception:
            pass

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Groq API Key not configured. Please add your key in Settings > AI & Automation.",
        )

    result = await convert_notes_to_lead(payload.raw_notes, api_key)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="AI extraction failed. Please verify your API key in Settings or fill in manually.",
        )
    return result


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
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> LeadOut:
    lead = await _get_lead_or_404(lead_id, session)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") and changes["status"] not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported lead status")

    previous_status = lead.status
    for key, value in changes.items():
        setattr(lead, key, value)

    if "status" in changes:
        await record_stage_history(
            session,
            workspace_id=auth.user_id,
            lead=lead,
            old_stage=previous_status,
            new_stage=lead.status,
            changed_by_user_id=auth.user_id,
            change_reason="manual_update",
        )

    text_blob = " ".join(filter(None, [lead.notes, lead.raw_note, lead.address, lead.industry]))
    await record_preference_history(
        session,
        workspace_id=auth.user_id,
        lead=lead,
        text=text_blob,
        detected_from="lead_update",
    )
    await evaluate_intelligence_alerts(
        session,
        workspace_id=auth.user_id,
        lead=lead,
        text=text_blob,
        source="lead_update",
    )

    await session.commit()
    await session.refresh(lead)
    return LeadOut.model_validate(lead)


@router.post("/{lead_id}/convert", status_code=status.HTTP_201_CREATED)
async def convert_lead(
    lead_id: str,
    payload: LeadConvertPayload,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    lead = await _get_lead_or_404(lead_id, session)
    if lead.converted_customer_id:
        customer = await session.get(Customer, lead.converted_customer_id)
        if customer:
            return {"customer": CustomerOut.model_validate(customer).model_dump(), "invoice": None, "opportunity_id": None}

    customer = Customer(
        company_name=lead.company_name,
        contact_person=lead.contact_person,
        assigned_user_id=lead.assigned_user_id or auth.user_id,
        stage="new",
        group_name=lead.source,
        tags={"lead_id": lead.id, "lead_source": lead.source},
        notes=f"Converted from lead {lead.id}. Source: {lead.source or 'unsourced' }.",
    )
    session.add(customer)
    await session.flush()

    budget = payload.budget or 0

    opportunity = Opportunity(
        customer_id=customer.id,
        title=f"Opportunity for {customer.company_name or customer.contact_person or 'Customer'}",
        stage="discovery",
        estimated_value=budget,
        currency="BDT",
    )
    session.add(opportunity)
    await session.flush()

    sales_order = SalesOrder(
        customer_id=customer.id,
        handler_user_id=customer.assigned_user_id,
        status="draft",
        payment_status="pending",
        total_amount=budget,
        currency="BDT",
        remark=f"Initial invoice for {customer.company_name}",
    )
    session.add(sales_order)
    await session.flush()

    task = Task(
        entity_type="opportunity",
        entity_id=opportunity.id,
        assigned_user_id=customer.assigned_user_id,
        title="Initial Outreach for New Deal",
        description="Follow up on the newly converted lead to kick off the discovery process.",
        priority="high",
    )
    session.add(task)

    audit = AuditLog(
        entity_type="lead",
        entity_id=lead.id,
        action="converted_to_customer",
        previous_value={"status": lead.status},
        new_value={"status": "won", "customer_id": customer.id, "opportunity_id": opportunity.id},
        performed_by_user_id=auth.user_id,
    )
    session.add(audit)

    old_status = lead.status
    lead.converted_customer_id = customer.id
    lead.status = "won"
    await record_stage_history(
        session,
        workspace_id=auth.user_id,
        lead=lead,
        old_stage=old_status,
        new_stage="won",
        changed_by_user_id=auth.user_id,
        change_reason="conversion",
    )

    await session.commit()
    await session.refresh(customer)
    await session.refresh(sales_order)
    return {
        "customer": CustomerOut.model_validate(customer).model_dump(),
        "invoice": {
            "id": sales_order.id,
            "customer_id": sales_order.customer_id,
            "status": sales_order.status,
            "payment_status": sales_order.payment_status,
            "total_amount": float(sales_order.total_amount),
            "currency": sales_order.currency,
            "remark": sales_order.remark,
            "created_at": sales_order.created_at.isoformat(),
        },
        "opportunity_id": opportunity.id,
    }
