from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import AIEvent, Conversation, Customer, Lead, Opportunity, Product, SalesOrder
from app.schemas.dashboard import DashboardIntelligence, DashboardSummary, PlatformChannelAnalytics
from app.services.intelligence import upsert_platform_metric


router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> DashboardSummary:
    customers = (await session.execute(select(func.count(Customer.id)))).scalar_one()
    leads = (await session.execute(select(func.count(Lead.id)).where(Lead.status.notin_(["won", "lost"])))).scalar_one()
    opportunities = (await session.execute(select(func.count(Opportunity.id)))).scalar_one()
    products = (await session.execute(select(func.count(Product.id)))).scalar_one()
    orders = (await session.execute(select(func.count(SalesOrder.id)))).scalar_one()

    order_rows = (
        await session.execute(
            select(SalesOrder.status, func.count(SalesOrder.id)).group_by(SalesOrder.status)
        )
    ).all()
    payment_rows = (
        await session.execute(
            select(SalesOrder.payment_status, func.count(SalesOrder.id)).group_by(SalesOrder.payment_status)
        )
    ).all()
    lead_source_rows = (
        await session.execute(
            select(Lead.source, func.count(Lead.id)).group_by(Lead.source)
        )
    ).all()
    converted_source_rows = (
        await session.execute(
            select(Lead.source, func.count(Lead.id))
            .where(Lead.converted_customer_id.is_not(None))
            .group_by(Lead.source)
        )
    ).all()

    platform_analytics: list[PlatformChannelAnalytics] = []
    for channel in ("facebook", "instagram", "whatsapp", "email", "website", "api"):
        active_conversations = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Conversation.status.in_(["open", "pending"]),
                )
            )
        ).scalar_one()
        new_conversations = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                )
            )
        ).scalar_one()
        ai_events_count = (
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                )
            )
        ).scalar_one()
        handover_count = (
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    AIEvent.event_type == "handover_trigger",
                )
            )
        ).scalar_one()
        converted_leads_count = (
            await session.execute(
                select(func.count(Lead.id))
                .join(Conversation, Conversation.id == Lead.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    Conversation.channel_type == channel,
                    Lead.converted_customer_id.is_not(None),
                )
            )
        ).scalar_one()

        platform_analytics.append(
            PlatformChannelAnalytics(
                channel_type=channel,
                active_conversations=active_conversations,
                new_conversations=new_conversations,
                ai_events_count=ai_events_count,
                handover_count=handover_count,
                converted_leads_count=converted_leads_count,
            )
        )
        await upsert_platform_metric(
            session,
            workspace_id=auth.user_id,
            channel_type=channel,
            active_conversations=active_conversations,
            new_conversations=new_conversations,
            ai_events_count=ai_events_count,
            handover_count=handover_count,
            converted_leads_count=converted_leads_count,
        )

    # ── Intelligence metrics ──────────────────────────────────────
    intent_rows = (
        await session.execute(
            select(Lead.intent, func.count(Lead.id))
            .where(Lead.intent.isnot(None), Lead.intent != "")
            .group_by(Lead.intent)
        )
    ).all()
    engagement_rows = (
        await session.execute(
            select(Lead.engagement, func.count(Lead.id))
            .where(Lead.engagement.isnot(None), Lead.engagement != "")
            .group_by(Lead.engagement)
        )
    ).all()
    trust_rows = (
        await session.execute(
            select(Lead.trust_level, func.count(Lead.id))
            .where(Lead.trust_level.isnot(None), Lead.trust_level != "")
            .group_by(Lead.trust_level)
        )
    ).all()
    lead_status_rows = (
        await session.execute(
            select(Lead.status, func.count(Lead.id))
            .group_by(Lead.status)
        )
    ).all()
    leads_with_budget = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.budget_min.isnot(None))
        )
    ).scalar_one()

    active_leads_count = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.status.notin_(["won", "lost"]))
        )
    ).scalar_one()
    closed_leads_count = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.status.in_(["won", "lost"]))
        )
    ).scalar_one()

    intelligence = DashboardIntelligence(
        intent_breakdown={row[0]: row[1] for row in intent_rows},
        engagement_breakdown={row[0]: row[1] for row in engagement_rows},
        trust_level_breakdown={row[0]: row[1] for row in trust_rows},
        lead_status_breakdown={row[0]: row[1] for row in lead_status_rows},
        leads_with_budget=leads_with_budget,
        active_leads_count=active_leads_count,
        closed_leads_count=closed_leads_count,
        ai_events_count=(
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(Conversation.workspace_id == auth.user_id)
            )
        ).scalar_one(),
        handover_count=(
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    AIEvent.event_type == "handover_trigger",
                )
            )
        ).scalar_one(),
    )

    return DashboardSummary(
        customers=customers,
        leads=leads,
        opportunities=opportunities,
        products=products,
        orders=orders,
        order_status_breakdown={row[0]: row[1] for row in order_rows},
        payment_status_breakdown={row[0]: row[1] for row in payment_rows},
        lead_source_breakdown={row[0] or "unsourced": row[1] for row in lead_source_rows},
        converted_source_breakdown={row[0] or "unsourced": row[1] for row in converted_source_rows},
        platform_analytics=platform_analytics,
        intelligence=intelligence,
    )
