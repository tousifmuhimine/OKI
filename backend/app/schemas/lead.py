from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class LeadBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    contact_person: str | None = None
    source: str | None = None
    status: str = "new"
    assigned_user_id: str | None = None
    notes: str | None = None
    email: str | None = None
    follow_up_date: datetime | None = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=255)
    contact_person: str | None = None
    source: str | None = None
    status: str | None = None
    assigned_user_id: str | None = None
    notes: str | None = None
    email: str | None = None
    follow_up_date: datetime | None = None


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


class LeadAnalyticsSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    by_source: dict[str, int]
    converted: int
    conversion_rate: float
