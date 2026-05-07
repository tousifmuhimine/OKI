from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AlertNotification,
    AlertRule,
    Conversation,
    Customer,
    CustomerPreference,
    Lead,
    LeadStageHistory,
    PlatformMetric,
)


COUNTRY_PATTERNS = {
    "bangladesh": "Bangladesh",
    "bd": "Bangladesh",
    "uk": "UK",
    "united kingdom": "UK",
    "usa": "USA",
    "us": "USA",
    "united states": "USA",
    "canada": "Canada",
    "ca": "Canada",
    "australia": "Australia",
    "aus": "Australia",
    "dubai": "Dubai",
}

CATEGORY_PATTERNS = {
    "real estate": "real_estate",
    "property": "real_estate",
    "apartment": "real_estate",
    "flat": "real_estate",
    "land": "real_estate",
    "ecommerce": "ecommerce",
    "shop": "ecommerce",
    "store": "ecommerce",
    "product": "ecommerce",
    "study abroad": "study_abroad",
    "student": "study_abroad",
    "admission": "study_abroad",
    "visa": "study_abroad",
}

PLATFORM_PATTERNS = {
    "whatsapp": "whatsapp",
    "messenger": "facebook",
    "facebook": "facebook",
    "email": "email",
    "website": "website",
}

BUDGET_REGEX = re.compile(r"(?:(?:bdt|tk|usd|\$|£|€)\s*)?(\d{2,}(?:[.,]\d{2,})?)", re.IGNORECASE)


@dataclass
class PreferenceSignal:
    field_name: str
    new_value: str
    detected_from: str
    confidence: float = 0.75


async def record_stage_history(
    session: AsyncSession,
    *,
    workspace_id: str,
    lead: Lead,
    old_stage: str | None,
    new_stage: str,
    changed_by_user_id: str | None = None,
    change_reason: str | None = None,
) -> LeadStageHistory | None:
    if not new_stage or old_stage == new_stage:
        return None

    history = LeadStageHistory(
        workspace_id=workspace_id,
        lead_id=lead.id,
        old_stage=old_stage,
        new_stage=new_stage,
        changed_by_user_id=changed_by_user_id,
        change_reason=change_reason,
    )
    session.add(history)
    await session.flush()
    return history


def extract_preference_signals(text: str | None) -> list[PreferenceSignal]:
    if not text:
        return []

    lowered = text.lower()
    signals: list[PreferenceSignal] = []

    for needle, country in COUNTRY_PATTERNS.items():
        if re.search(rf"\b{re.escape(needle)}\b", lowered):
            signals.append(PreferenceSignal("preferred_country", country, f"matched:{needle}", 0.82))
            break

    for needle, category in CATEGORY_PATTERNS.items():
        if re.search(rf"\b{re.escape(needle)}\b", lowered):
            signals.append(PreferenceSignal("product_category", category, f"matched:{needle}", 0.78))
            break

    for needle, platform in PLATFORM_PATTERNS.items():
        if re.search(rf"\b{re.escape(needle)}\b", lowered):
            signals.append(PreferenceSignal("preferred_platform", platform, f"matched:{needle}", 0.9))
            break

    budget_match = BUDGET_REGEX.search(lowered)
    if budget_match:
        signals.append(PreferenceSignal("budget_hint", budget_match.group(1).replace(",", ""), "budget_regex", 0.7))

    if any(word in lowered for word in ("urgent", "asap", "quick", "soon")):
        signals.append(PreferenceSignal("urgency", "high", "urgency_keyword", 0.74))

    return signals


async def record_preference_history(
    session: AsyncSession,
    *,
    workspace_id: str,
    lead: Lead | None = None,
    customer: Customer | None = None,
    text: str | None = None,
    detected_from: str = "message",
) -> list[CustomerPreference]:
    signals = extract_preference_signals(text)
    records: list[CustomerPreference] = []

    if not signals:
        return records

    target_customer_id = customer.id if customer else (lead.converted_customer_id if lead else None)
    target_lead_id = lead.id if lead else None

    for signal in signals:
        existing = None
        if target_lead_id or target_customer_id:
            existing_query = select(CustomerPreference).where(
                CustomerPreference.workspace_id == workspace_id,
                CustomerPreference.field_name == signal.field_name,
            )
            if target_lead_id:
                existing_query = existing_query.where(CustomerPreference.lead_id == target_lead_id)
            if target_customer_id:
                existing_query = existing_query.where(CustomerPreference.customer_id == target_customer_id)
            existing_query = existing_query.order_by(CustomerPreference.detected_at.desc()).limit(1)
            existing = (await session.execute(existing_query)).scalar_one_or_none()

        if existing and existing.new_value == signal.new_value:
            continue

        record = CustomerPreference(
            workspace_id=workspace_id,
            customer_id=target_customer_id,
            lead_id=target_lead_id,
            field_name=signal.field_name,
            old_value=existing.new_value if existing else None,
            new_value=signal.new_value,
            detected_from=signal.detected_from or detected_from,
            confidence=signal.confidence,
            source_message=text,
            detected_at=datetime.now(timezone.utc),
        )
        session.add(record)
        records.append(record)

    if records:
        await session.flush()
    return records


async def create_alert_notification(
    session: AsyncSession,
    *,
    workspace_id: str,
    title: str,
    message: str,
    severity: str = "medium",
    alert_rule_id: str | None = None,
    conversation_id: str | None = None,
    lead_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AlertNotification:
    notification = AlertNotification(
        workspace_id=workspace_id,
        alert_rule_id=alert_rule_id,
        conversation_id=conversation_id,
        lead_id=lead_id,
        title=title,
        message=message,
        severity=severity,
        payload=payload or {},
    )
    session.add(notification)
    await session.flush()
    return notification


async def evaluate_intelligence_alerts(
    session: AsyncSession,
    *,
    workspace_id: str,
    lead: Lead | None = None,
    conversation: Conversation | None = None,
    text: str | None = None,
    intent: str | None = None,
    source: str = "message",
) -> list[AlertNotification]:
    notifications: list[AlertNotification] = []
    lowered = (text or "").lower()

    if lead:
        if lead.status == "proposal" or (lead.trust_level or "").lower() in {"low", "declining"}:
            notifications.append(
                await create_alert_notification(
                    session,
                    workspace_id=workspace_id,
                    title=f"Lead needs attention: {lead.company_name}",
                    message="A lead entered a sensitive state that may require a human follow-up.",
                    severity="high",
                    lead_id=lead.id,
                    conversation_id=conversation.id if conversation else lead.conversation_id,
                    payload={"source": source, "status": lead.status, "trust_level": lead.trust_level},
                )
            )

        if lead.budget_max and float(lead.budget_max or 0) >= 100000:
            notifications.append(
                await create_alert_notification(
                    session,
                    workspace_id=workspace_id,
                    title=f"High value lead: {lead.company_name}",
                    message="Budget or estimate is above the high-value threshold.",
                    severity="medium",
                    lead_id=lead.id,
                    conversation_id=conversation.id if conversation else lead.conversation_id,
                    payload={"source": source, "budget_max": float(lead.budget_max or 0)},
                )
            )

    if conversation and (conversation.is_bot_paused or conversation.assigned_user_id):
        notifications.append(
            await create_alert_notification(
                session,
                workspace_id=workspace_id,
                title="Conversation requires agent takeover",
                message="The bot is paused or the conversation is already assigned to an agent.",
                severity="medium",
                conversation_id=conversation.id,
                lead_id=lead.id if lead else None,
                payload={"source": source, "intent": intent},
            )
        )

    if intent and intent.lower() == "serious" and not notifications:
        notifications.append(
            await create_alert_notification(
                session,
                workspace_id=workspace_id,
                title="Serious intent detected",
                message="The conversation shows strong buying intent and should be reviewed.",
                severity="medium",
                conversation_id=conversation.id if conversation else None,
                lead_id=lead.id if lead else None,
                payload={"source": source, "intent": intent},
            )
        )

    if lowered and any(word in lowered for word in ("price", "quote", "budget", "payment", "refund")) and not notifications:
        notifications.append(
            await create_alert_notification(
                session,
                workspace_id=workspace_id,
                title="Commercial inquiry detected",
                message="The message includes pricing or payment cues that may need faster handling.",
                severity="low",
                conversation_id=conversation.id if conversation else None,
                lead_id=lead.id if lead else None,
                payload={"source": source},
            )
        )

    if notifications:
        await session.flush()
    return notifications


async def upsert_platform_metric(
    session: AsyncSession,
    *,
    workspace_id: str,
    channel_type: str,
    active_conversations: int,
    new_conversations: int,
    ai_events_count: int,
    handover_count: int,
    converted_leads_count: int,
    metric_date: datetime | None = None,
) -> PlatformMetric:
    metric_date = metric_date or datetime.now(timezone.utc)
    existing = (
        await session.execute(
            select(PlatformMetric).where(
                PlatformMetric.workspace_id == workspace_id,
                PlatformMetric.channel_type == channel_type,
                PlatformMetric.metric_date >= metric_date.replace(hour=0, minute=0, second=0, microsecond=0),
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.active_conversations = active_conversations
        existing.new_conversations = new_conversations
        existing.ai_events_count = ai_events_count
        existing.handover_count = handover_count
        existing.converted_leads_count = converted_leads_count
        await session.flush()
        return existing

    metric = PlatformMetric(
        workspace_id=workspace_id,
        channel_type=channel_type,
        metric_date=metric_date,
        active_conversations=active_conversations,
        new_conversations=new_conversations,
        ai_events_count=ai_events_count,
        handover_count=handover_count,
        converted_leads_count=converted_leads_count,
    )
    session.add(metric)
    await session.flush()
    return metric
