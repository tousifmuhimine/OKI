from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class LeadBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    contact_person: str | None = None
    phone: str | None = None
    address: str | None = None
    industry: str | None = None
    source: str | None = None
    status: str = "new"
    assigned_user_id: str | None = None
    notes: str | None = None
    email: str | None = None
    follow_up_date: datetime | None = None
    # Dynamic industry-specific payload
    industry_data: dict | None = None
    # Raw agent note for audit trail
    raw_note: str | None = None
    # Agent UUID who submitted this lead
    agent_id: str | None = None
    # New dynamic fields (Step 2)
    intent: str | None = None
    engagement: str | None = None
    trust_level: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    last_summary: str | None = None
    assigned_agent_id: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_person: str | None = None
    phone: str | None = None
    address: str | None = None
    industry: str | None = None
    source: str | None = None
    status: str | None = None
    assigned_user_id: str | None = None
    notes: str | None = None
    email: str | None = None
    follow_up_date: datetime | None = None
    industry_data: dict | None = None
    raw_note: str | None = None
    agent_id: str | None = None
    # New dynamic fields (Step 2)
    intent: str | None = None
    engagement: str | None = None
    trust_level: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    last_summary: str | None = None
    assigned_agent_id: str | None = None


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contact_id: str | None
    inbox_id: str | None
    conversation_id: str | None
    capture_source: str | None
    converted_customer_id: str | None
    created_at: datetime
    updated_at: datetime


class LeadListResponse(BaseModel):
    data: list[LeadOut]
    meta: PaginationMeta


class LeadConvertPayload(BaseModel):
    budget: float | None = None  # estimated deal value in BDT


class LeadAnalyticsSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    by_source: dict[str, int]
    converted: int
    conversion_rate: float
