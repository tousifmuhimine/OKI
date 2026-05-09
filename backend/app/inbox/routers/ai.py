from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.api.deps import has_permission
from app.db.models import AIEvent, Conversation, UserLLMConfig
from app.inbox.llm_providers.groq import SUPPORTED_GROQ_MODELS
from app.inbox.security import encrypt_channel_config, summarize_channel_config
from app.schemas.llm import UserLLMConfigCreate, UserLLMConfigRead
from app.services.ai_reply import generate_ai_reply
from app.services.entity_extraction import (
    extract_entities_from_message,
    update_lead_from_extracted_entities,
    detect_intent_from_message,
    update_lead_intent,
)
from app.schemas.lead import LeadOut


router = APIRouter()


class GenerateReplyRequest(BaseModel):
    """Request to generate an AI reply."""
    message: str = Field(min_length=1, description="The customer message to reply to")
    company_type: str | None = Field(default=None, description="Company type (ecommerce, real_estate, study_abroad)")


class GenerateReplyResponse(BaseModel):
    """Response with generated AI reply."""
    reply: str = Field(description="Generated AI reply")
    model: str = Field(description="AI model used")
    provider: str = Field(description="AI provider used")


class ExtractEntitiesRequest(BaseModel):
    """Request to extract entities from a message."""
    message: str = Field(min_length=1, description="The message to extract entities from")
    lead_id: str | None = Field(default=None, description="Optional lead ID to update with extracted data")


class ExtractedEntitiesResponse(BaseModel):
    """Response with extracted entities."""
    name: str | None = Field(default=None, description="Extracted name")
    phone: str | None = Field(default=None, description="Extracted phone number")
    email: str | None = Field(default=None, description="Extracted email address")
    address: str | None = Field(default=None, description="Extracted address/location")
    budget: float | None = Field(default=None, description="Extracted budget amount")
    lead: LeadOut | None = Field(default=None, description="Updated lead if lead_id was provided")


class DetectIntentRequest(BaseModel):
    """Request to detect customer intent from a message."""
    message: str = Field(min_length=1, description="The message to classify")
    lead_id: str | None = Field(default=None, description="Optional lead ID to update with detected intent")


class DetectIntentResponse(BaseModel):
    """Response with detected intent."""
    intent: str | None = Field(default=None, description="Detected intent: browsing, comparing, or serious")
    lead: LeadOut | None = Field(default=None, description="Updated lead if lead_id was provided")


def _validate_groq_models(payload: UserLLMConfigCreate) -> None:
    if payload.provider != "groq":
        return

    allowed = set(SUPPORTED_GROQ_MODELS)
    invalid_models: list[str] = []

    if payload.default_model and payload.default_model not in allowed:
        invalid_models.append(payload.default_model)

    for model in (payload.model_preferences or {}).values():
        if model and model not in allowed and model not in invalid_models:
            invalid_models.append(model)

    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported Groq model(s): "
                + ", ".join(sorted(invalid_models))
                + ". Use one of: "
                + ", ".join(SUPPORTED_GROQ_MODELS)
            ),
        )


@router.get("/config", response_model=list[UserLLMConfigRead])
async def list_configs(
    auth: AuthContext = Depends(get_current_auth), session: AsyncSession = Depends(get_session_dep)
):
    q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
    res = await session.execute(q)
    rows = res.scalars().all()

    # mask encrypted config when returning
    results = []
    for r in rows:
        results.append(UserLLMConfigRead(
            id=r.id,
            provider=r.provider,
            default_model=r.default_model,
            model_preferences=r.model_preferences or {},
            automation_modes=r.automation_modes or {},
        ))

    return results


@router.post("/config", response_model=UserLLMConfigRead)
async def upsert_config(
    payload: UserLLMConfigCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    if not await has_permission(session, auth.user_id, auth.user_id, "ai.settings"):
        raise HTTPException(status_code=403, detail="Permission denied")
    _validate_groq_models(payload)

    # encrypt api key and optional api_url using channel config cipher
    cfg: dict[str, str] = {"api_key": payload.api_key}
    if getattr(payload, "api_url", None):
        cfg["api_url"] = payload.api_url
    enc = encrypt_channel_config(cfg)

    # try update existing record for same provider & user
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == auth.user_id, UserLLMConfig.provider == payload.provider
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()

    if existing:
        stmt = (
            update(UserLLMConfig)
            .where(UserLLMConfig.id == existing.id)
            .values(
                encrypted_config=enc,
                default_model=payload.default_model,
                model_preferences=payload.model_preferences or {},
                automation_modes=payload.automation_modes or {},
            )
        )
        await session.execute(stmt)
        await session.commit()
        existing.encrypted_config = enc
        existing.default_model = payload.default_model
        existing.model_preferences = payload.model_preferences or {}
        existing.automation_modes = payload.automation_modes or {}
        r = existing
    else:
        r = UserLLMConfig(
            workspace_id=auth.user_id,
            user_id=auth.user_id,
            provider=payload.provider,
            encrypted_config=enc,
            default_model=payload.default_model,
            model_preferences=payload.model_preferences or {},
            automation_modes=payload.automation_modes or {},
        )
        session.add(r)
        await session.commit()
        await session.refresh(r)

    return UserLLMConfigRead(
        id=r.id,
        provider=r.provider,
        default_model=r.default_model,
        model_preferences=r.model_preferences or {},
        automation_modes=r.automation_modes or {},
    )


@router.delete("/config/{config_id}")
async def delete_config(
    config_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    if not await has_permission(session, auth.user_id, auth.user_id, "ai.settings"):
        raise HTTPException(status_code=403, detail="Permission denied")
    q = select(UserLLMConfig).where(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == auth.user_id,
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")

    await session.delete(existing)
    await session.commit()
    return {"deleted": True, "id": config_id}


@router.post("/reply", response_model=GenerateReplyResponse)
async def generate_reply(
    payload: GenerateReplyRequest,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> GenerateReplyResponse:
    """Generate an AI reply to a customer message.
    
    The reply is generated using the user's configured AI provider (Groq, etc.)
    and tailored to the company type (ecommerce, real_estate, study_abroad, etc.)
    """
    try:
        reply = await generate_ai_reply(
            session,
            message=payload.message,
            company_type=payload.company_type,
            workspace_id=auth.user_id,
            user_id=auth.user_id,
        )
        
        # Get user's config to return provider info
        q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
        res = await session.execute(q)
        config = res.scalar_one_or_none()
        
        return GenerateReplyResponse(
            reply=reply,
            model=config.default_model or "llama-3.1-8b-instant" if config else "unknown",
            provider=config.provider if config else "unknown",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate reply: {str(e)}")


@router.post("/extract-entities", response_model=ExtractedEntitiesResponse)
async def extract_entities(
    payload: ExtractEntitiesRequest,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ExtractedEntitiesResponse:
    """Extract structured entities (name, phone, email, address, budget) from a message.
    
    Optionally update a lead with the extracted data.
    Uses the user's configured AI provider for extraction.
    """
    try:
        # Extract entities from message
        entities = await extract_entities_from_message(
            session,
            message=payload.message,
            workspace_id=auth.user_id,
            user_id=auth.user_id,
        )
        
        # Update lead if lead_id provided
        updated_lead = None
        if payload.lead_id:
            updated_lead = await update_lead_from_extracted_entities(
                session,
                payload.lead_id,
                entities,
            )
            await session.commit()
        
        return ExtractedEntitiesResponse(
            name=entities.name,
            phone=entities.phone,
            email=entities.email,
            address=entities.address,
            budget=entities.budget,
            lead=LeadOut.model_validate(updated_lead) if updated_lead else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract entities: {str(e)}")


@router.post("/detect-intent", response_model=DetectIntentResponse)
async def detect_intent(
    payload: DetectIntentRequest,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> DetectIntentResponse:
    """Detect customer intent from a message and optionally persist it to a lead."""
    try:
        classification = await detect_intent_from_message(
            session,
            message=payload.message,
            workspace_id=auth.user_id,
            user_id=auth.user_id,
        )

        updated_lead = None
        if payload.lead_id and classification.intent:
            updated_lead = await update_lead_intent(session, payload.lead_id, classification.intent)
            await session.commit()

        return DetectIntentResponse(
            intent=classification.intent,
            lead=LeadOut.model_validate(updated_lead) if updated_lead else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect intent: {str(e)}")


class MonitorStatusResponse(BaseModel):
    configured: bool
    error: str | None = None
    configs: list[dict[str, Any]] = []
    recent_events: list[dict[str, Any]] = []
    events_today: int = 0
    events_this_week: int = 0
    handovers_today: int = 0
    handovers_this_week: int = 0
    automation_summary: dict[str, str] = {}


@router.get("/monitor/status", response_model=MonitorStatusResponse)
async def ai_monitor_status(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> MonitorStatusResponse:
    """Return AI system status for monitoring dashboard."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    # Configs
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == auth.user_id
    )
    rows = (await session.execute(q)).scalars().all()
    configs = []
    automation_summary: dict[str, str] = {}
    for r in rows:
        configs.append({
            "id": r.id,
            "provider": r.provider,
            "default_model": r.default_model,
            "automation_modes": r.automation_modes or {},
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
        for ch, mode in (r.automation_modes or {}).items():
            automation_summary[ch] = mode

    # Recent events (last 50)
    event_rows = (
        await session.execute(
            select(AIEvent)
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(Conversation.workspace_id == auth.user_id)
            .order_by(AIEvent.created_at.desc())
            .limit(50)
        )
    ).scalars().all()
    recent_events = [
        {
            "id": e.id,
            "conversation_id": e.conversation_id,
            "event_type": e.event_type,
            "payload": e.payload or {},
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in event_rows
    ]

    # Counts
    events_today = (
        await session.execute(
            select(func.count(AIEvent.id))
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(
                Conversation.workspace_id == auth.user_id,
                AIEvent.created_at >= today_start,
            )
        )
    ).scalar_one()

    events_this_week = (
        await session.execute(
            select(func.count(AIEvent.id))
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(
                Conversation.workspace_id == auth.user_id,
                AIEvent.created_at >= week_start,
            )
        )
    ).scalar_one()

    handovers_today = (
        await session.execute(
            select(func.count(AIEvent.id))
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(
                Conversation.workspace_id == auth.user_id,
                AIEvent.event_type == "handover_trigger",
                AIEvent.created_at >= today_start,
            )
        )
    ).scalar_one()

    handovers_this_week = (
        await session.execute(
            select(func.count(AIEvent.id))
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(
                Conversation.workspace_id == auth.user_id,
                AIEvent.event_type == "handover_trigger",
                AIEvent.created_at >= week_start,
            )
        )
    ).scalar_one()

    return MonitorStatusResponse(
        configured=len(configs) > 0,
        error=None,
        configs=configs,
        recent_events=recent_events,
        events_today=events_today,
        events_this_week=events_this_week,
        handovers_today=handovers_today,
        handovers_this_week=handovers_this_week,
        automation_summary=automation_summary,
    )
