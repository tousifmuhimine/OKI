from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Contact, Conversation, Inbox, Lead


async def upsert_lead_from_inbound_message(
    session: AsyncSession,
    *,
    inbox: Inbox,
    contact: Contact,
    conversation: Conversation,
    channel_type: str,
    capture_source: str,
) -> Lead:
    existing = (
        await session.execute(
            select(Lead)
            .where(
                Lead.contact_id == contact.id,
                Lead.converted_customer_id.is_(None),
            )
            .order_by(Lead.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if existing:
        existing.inbox_id = inbox.id
        existing.conversation_id = conversation.id
        existing.source = existing.source or channel_type
        existing.capture_source = existing.capture_source or capture_source
        if not existing.contact_person and contact.name:
            existing.contact_person = contact.name
        if not existing.company_name and contact.name:
            existing.company_name = contact.name
        await session.flush()
        return existing

    lead = Lead(
        company_name=contact.name or f"{channel_type.title()} lead",
        contact_person=contact.name or None,
        source=channel_type,
        status="new",
        assigned_user_id=inbox.workspace_id,
        contact_id=contact.id,
        inbox_id=inbox.id,
        conversation_id=conversation.id,
        capture_source=capture_source,
    )
    session.add(lead)
    await session.flush()
    return lead
