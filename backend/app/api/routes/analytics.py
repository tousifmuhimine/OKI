"""Detailed platform analytics endpoint with historical data."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import (
    AIEvent,
    AlertNotification,
    Conversation,
    Lead,
    Message,
    PlatformMetric,
)


router = APIRouter()


@router.get("/platform-analytics")
async def platform_analytics(
    days: int = Query(default=7, ge=1, le=90),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    """Get detailed platform analytics with historical data."""
    since = datetime.utcnow() - timedelta(days=days)

    # Channel summaries
    channels = ["facebook", "instagram", "whatsapp", "email", "website", "api"]
    channel_data = []
    total_active = 0
    total_ai = 0
    total_handovers = 0
    total_converted = 0
    total_messages = 0

    for channel in channels:
        active = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Conversation.status.in_(["open", "pending"]),
                    Conversation.last_message_at >= since,
                )
            )
        ).scalar_one()

        total_conv = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Conversation.last_message_at >= since,
                )
            )
        ).scalar_one()

        ai_count = (
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    AIEvent.created_at >= since,
                )
            )
        ).scalar_one()

        handover = (
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    AIEvent.event_type == "handover_trigger",
                    AIEvent.created_at >= since,
                )
            )
        ).scalar_one()

        converted = (
            await session.execute(
                select(func.count(Lead.id))
                .join(Conversation, Conversation.id == Lead.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Lead.converted_customer_id.is_not(None),
                    Lead.updated_at >= since,
                )
            )
        ).scalar_one()

        msg_count = (
            await session.execute(
                select(func.count(Message.id))
                .join(Conversation, Conversation.id == Message.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Message.created_at >= since,
                )
            )
        ).scalar_one()

        total_active += active
        total_ai += ai_count
        total_handovers += handover
        total_converted += converted
        total_messages += msg_count

        ai_rate = round((handover / max(ai_count, 1)) * 100, 1) if ai_count > 0 else 0
        resolve_rate = round((converted / max(total_conv, 1)) * 100, 1) if total_conv > 0 else 0

        channel_data.append({
            "channel_type": channel,
            "active_conversations": active,
            "total_conversations": total_conv,
            "ai_events": ai_count,
            "handovers": handover,
            "converted_leads": converted,
            "total_messages": msg_count,
            "ai_handover_rate": ai_rate,
            "conversion_rate": resolve_rate,
        })

    # Historical metrics (daily snapshots from PlatformMetric)
    metric_rows = (
        await session.execute(
            select(PlatformMetric)
            .where(
                PlatformMetric.workspace_id == auth.user_id,
                PlatformMetric.recorded_at >= since,
            )
            .order_by(PlatformMetric.recorded_at.asc())
        )
    ).scalars().all()

    # Group metrics by date
    daily_metrics = {}
    for metric in metric_rows:
        day_key = metric.recorded_at.strftime("%Y-%m-%d")
        if day_key not in daily_metrics:
            daily_metrics[day_key] = {
                "date": day_key,
                "active_conversations": 0,
                "new_conversations": 0,
                "ai_events": 0,
                "handovers": 0,
                "converted_leads": 0,
            }
        daily_metrics[day_key]["active_conversations"] += metric.active_conversations or 0
        daily_metrics[day_key]["new_conversations"] += metric.new_conversations or 0
        daily_metrics[day_key]["ai_events"] += metric.ai_events_count or 0
        daily_metrics[day_key]["handovers"] += metric.handover_count or 0
        daily_metrics[day_key]["converted_leads"] += metric.converted_leads_count or 0

    # Top converted sources
    top_converted = (
        await session.execute(
            select(Lead.source, func.count(Lead.id))
            .where(
                Lead.converted_customer_id.is_not(None),
                Lead.updated_at >= since,
            )
            .group_by(Lead.source)
            .order_by(func.count(Lead.id).desc())
            .limit(5)
        )
    ).all()

    # AI events by type
    ai_event_types = (
        await session.execute(
            select(AIEvent.event_type, func.count(AIEvent.id))
            .join(Conversation, Conversation.id == AIEvent.conversation_id)
            .where(
                Conversation.workspace_id == auth.user_id,
                AIEvent.created_at >= since,
            )
            .group_by(AIEvent.event_type)
            .order_by(func.count(AIEvent.id).desc())
        )
    ).all()

    # Unread alert notifications
    unread_notifications = (
        await session.execute(
            select(func.count(AlertNotification.id)).where(
                AlertNotification.workspace_id == auth.user_id,
                AlertNotification.read_at.is_(None),
            )
        )
    ).scalar_one()

    return {
        "channels": channel_data,
        "totals": {
            "active_conversations": total_active,
            "ai_events": total_ai,
            "handovers": total_handovers,
            "converted_leads": total_converted,
            "total_messages": total_messages,
            "unread_notifications": unread_notifications,
        },
        "daily_metrics": list(daily_metrics.values()),
        "top_converted_sources": [{"source": r[0] or "unknown", "count": r[1]} for r in top_converted],
        "ai_event_types": [{"type": r[0], "count": r[1]} for r in ai_event_types],
    }