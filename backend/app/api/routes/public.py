from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session_dep
from app.db.models import Lead, LeadShareLink
from app.schemas.lead import PublicLeadOut, PublicShareLinkOut


router = APIRouter()


@router.get("/leads/{token}", response_model=PublicShareLinkOut)
async def get_public_lead(
    token: str,
    email: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session_dep),
) -> PublicShareLinkOut:
    share = (
        await session.execute(select(LeadShareLink).where(LeadShareLink.token == token))
    ).scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share.expires_at and share.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link expired")

    if not share.is_public:
        if not email:
            raise HTTPException(status_code=401, detail="Email required")
        allowed = {e.lower() for e in (share.allowed_emails or [])}
        if email.lower() not in allowed:
            raise HTTPException(status_code=403, detail="Email not allowed")

    # Fetch all leads in this share link (fall back to share.lead_id if lead_ids is empty)
    lead_ids = share.lead_ids if share.lead_ids else [share.lead_id]
    leads = []
    for lid in lead_ids:
        lead = await session.get(Lead, lid)
        if lead:
            leads.append(
                PublicLeadOut(
                    id=lead.id,
                    company_name=lead.company_name,
                    contact_person=lead.contact_person,
                    phone=lead.phone,
                    email=lead.email,
                    status=lead.status,
                    priority=lead.priority,
                    lead_stage_id=lead.lead_stage_id,
                    lead_source_id=lead.lead_source_id,
                    tags=lead.tags,
                    notes=lead.notes,
                    created_at=lead.created_at,
                )
            )

    if not leads:
        raise HTTPException(status_code=404, detail="Shared leads not found")

    return PublicShareLinkOut(
        id=share.id,
        is_public=share.is_public,
        expires_at=share.expires_at,
        leads=leads,
    )

