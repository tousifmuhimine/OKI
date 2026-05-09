from pydantic import BaseModel, Field


class PlatformChannelAnalytics(BaseModel):
    channel_type: str
    active_conversations: int = 0
    new_conversations: int = 0
    ai_events_count: int = 0
    handover_count: int = 0
    converted_leads_count: int = 0


class DashboardIntelligence(BaseModel):
    """AI intelligence metrics aggregated from leads."""
    intent_breakdown: dict[str, int] = Field(default_factory=dict)
    engagement_breakdown: dict[str, int] = Field(default_factory=dict)
    trust_level_breakdown: dict[str, int] = Field(default_factory=dict)
    leads_with_budget: int = 0
    ai_events_count: int = 0
    handover_count: int = 0


class DashboardSummary(BaseModel):
    customers: int
    leads: int
    opportunities: int
    products: int
    orders: int
    order_status_breakdown: dict[str, int]
    payment_status_breakdown: dict[str, int]
    lead_source_breakdown: dict[str, int]
    converted_source_breakdown: dict[str, int]
    platform_analytics: list[PlatformChannelAnalytics] = Field(default_factory=list)
    intelligence: DashboardIntelligence = Field(default_factory=DashboardIntelligence)
