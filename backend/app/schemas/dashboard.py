from pydantic import BaseModel, Field


class PlatformChannelAnalytics(BaseModel):
    channel_type: str
    active_conversations: int = 0
    new_conversations: int = 0
    ai_events_count: int = 0
    handover_count: int = 0
    converted_leads_count: int = 0
    ai_rate: float = 0.0  # percentage of conversations handled by AI


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
    # AI monitoring metrics
    ai_response_count: int = 0
    human_takeover_count: int = 0
    failed_conversations: int = 0
    total_conversations: int = 0
    conversion_rate: float = 0.0   # leads converted / total leads
    drop_off_rate: float = 0.0     # resolved/closed without conversion
    unread_notifications: int = 0

