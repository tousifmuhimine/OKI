from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.api.deps import has_permission
from app.db.models import AIEvent, Conversation, Customer, Lead, Opportunity, Product, SalesOrder
from app.schemas.dashboard import DashboardIntelligence, DashboardSummary, PlatformChannelAnalytics
from app.services.intelligence import upsert_platform_metric


router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> DashboardSummary:
    scoped_to_assigned = auth.role != "admin" and not await has_permission(session, auth.user_id, auth, "analytics.view")
    conversation_scope_filters = [] if not scoped_to_assigned else [Conversation.assigned_user_id == auth.user_id]
    lead_scope_filters = [] if not scoped_to_assigned else [Lead.assigned_user_id == auth.user_id]

    customers_query = select(func.count(Customer.id))
    leads_query = select(func.count(Lead.id)).where(Lead.status.notin_(["won", "lost"]))
    opportunities_query = select(func.count(Opportunity.id))
    products_query = select(func.count(Product.id))
    orders_query = select(func.count(SalesOrder.id))

    if scoped_to_assigned:
        customers_query = customers_query.where(Customer.assigned_user_id == auth.user_id)
        leads_query = leads_query.where(Lead.assigned_user_id == auth.user_id)
        opportunities_query = opportunities_query.join(Customer, Customer.id == Opportunity.customer_id).where(Customer.assigned_user_id == auth.user_id)
        orders_query = orders_query.join(Customer, Customer.id == SalesOrder.customer_id).where(Customer.assigned_user_id == auth.user_id)

    customers = (await session.execute(customers_query)).scalar_one()
    leads = (await session.execute(leads_query)).scalar_one()
    opportunities = (await session.execute(opportunities_query)).scalar_one()
    products = (await session.execute(products_query)).scalar_one()
    orders = (await session.execute(orders_query)).scalar_one()

    order_rows_query = select(SalesOrder.status, func.count(SalesOrder.id)).group_by(SalesOrder.status)
    payment_rows_query = select(SalesOrder.payment_status, func.count(SalesOrder.id)).group_by(SalesOrder.payment_status)
    if scoped_to_assigned:
        order_rows_query = order_rows_query.join(Customer, Customer.id == SalesOrder.customer_id).where(Customer.assigned_user_id == auth.user_id)
        payment_rows_query = payment_rows_query.join(Customer, Customer.id == SalesOrder.customer_id).where(Customer.assigned_user_id == auth.user_id)

    order_rows = (await session.execute(order_rows_query)).all()
    payment_rows = (await session.execute(payment_rows_query)).all()
    lead_source_rows = (
        await session.execute(
            select(Lead.source, func.count(Lead.id)).where(*lead_scope_filters).group_by(Lead.source)
        )
    ).all()
    converted_source_rows = (
        await session.execute(
            select(Lead.source, func.count(Lead.id))
            .where(Lead.converted_customer_id.is_not(None), *lead_scope_filters)
            .group_by(Lead.source)
        )
    ).all()

    converted_leads_tags = (
        await session.execute(
            select(Lead.tags).where(Lead.converted_customer_id.is_not(None), *lead_scope_filters)
        )
    ).scalars().all()
    converted_tags_breakdown = {}
    for tags in converted_leads_tags:
        if isinstance(tags, list):
            for t in tags:
                if t:
                    converted_tags_breakdown[t] = converted_tags_breakdown.get(t, 0) + 1

    now = datetime.utcnow()
    start_of_day = datetime(now.year, now.month, now.day)
    start_of_week = start_of_day - timedelta(days=start_of_day.weekday())
    start_of_month = datetime(now.year, now.month, 1)

    assigned_leads_daily_query = select(func.count(Lead.id)).where(Lead.assigned_user_id == auth.user_id, Lead.created_at >= start_of_day)
    assigned_leads_weekly_query = select(func.count(Lead.id)).where(Lead.assigned_user_id == auth.user_id, Lead.created_at >= start_of_week)
    assigned_leads_monthly_query = select(func.count(Lead.id)).where(Lead.assigned_user_id == auth.user_id, Lead.created_at >= start_of_month)
    assigned_leads_daily = (await session.execute(assigned_leads_daily_query)).scalar_one()
    assigned_leads_weekly = (await session.execute(assigned_leads_weekly_query)).scalar_one()
    assigned_leads_monthly = (await session.execute(assigned_leads_monthly_query)).scalar_one()

    platform_analytics: list[PlatformChannelAnalytics] = []
    for channel in ("facebook", "instagram", "whatsapp", "email", "website", "api"):
        active_conversations = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    *conversation_scope_filters,
                    Conversation.channel_type == channel,
                    Conversation.status.in_(["open", "pending"]),
                )
            )
        ).scalar_one()
        new_conversations = (
            await session.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.workspace_id == auth.user_id,
                    *conversation_scope_filters,
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
                    *conversation_scope_filters,
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
                    *conversation_scope_filters,
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
                    *conversation_scope_filters,
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
            .where(*lead_scope_filters)
            .where(Lead.intent.isnot(None), Lead.intent != "")
            .group_by(Lead.intent)
        )
    ).all()
    engagement_rows = (
        await session.execute(
            select(Lead.engagement, func.count(Lead.id))
            .where(*lead_scope_filters)
            .where(Lead.engagement.isnot(None), Lead.engagement != "")
            .group_by(Lead.engagement)
        )
    ).all()
    trust_rows = (
        await session.execute(
            select(Lead.trust_level, func.count(Lead.id))
            .where(*lead_scope_filters)
            .where(Lead.trust_level.isnot(None), Lead.trust_level != "")
            .group_by(Lead.trust_level)
        )
    ).all()
    lead_status_rows = (
        await session.execute(
            select(Lead.status, func.count(Lead.id))
            .where(*lead_scope_filters)
            .group_by(Lead.status)
        )
    ).all()
    leads_with_budget = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.budget_min.isnot(None), *lead_scope_filters)
        )
    ).scalar_one()

    active_leads_count = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.status.notin_(["won", "lost"]), *lead_scope_filters)
        )
    ).scalar_one()
    closed_leads_count = (
        await session.execute(
            select(func.count(Lead.id)).where(Lead.status.in_(["won", "lost"]), *lead_scope_filters)
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
                .where(Conversation.workspace_id == auth.user_id, *conversation_scope_filters)
            )
        ).scalar_one(),
        handover_count=(
            await session.execute(
                select(func.count(AIEvent.id))
                .join(Conversation, Conversation.id == AIEvent.conversation_id)
                .where(
                    Conversation.workspace_id == auth.user_id,
                    *conversation_scope_filters,
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
        converted_tags_breakdown=converted_tags_breakdown,
        platform_analytics=platform_analytics,
        intelligence=intelligence,
        assigned_leads_daily=assigned_leads_daily,
        assigned_leads_weekly=assigned_leads_weekly,
        assigned_leads_monthly=assigned_leads_monthly,
    )
