from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class CustomerPreferenceOut(BaseModel):
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    detected_from: str | None = None
    confidence: float = 0
    detected_at: datetime


class CustomerLeadIntelligence(BaseModel):
    lead_id: str
    intent: str | None = None
    engagement: str | None = None
    trust_level: str | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    last_summary: str | None = None
    updated_at: datetime


class CustomerBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    country_region: str | None = None
    assigned_user_id: str | None = None
    stage: str = "new"
    group_name: str | None = None
    tags: dict = Field(default_factory=dict)
    score: int = 0
    notes: str | None = None
    # Company type: ecommerce, real_estate, study_abroad
    type: str | None = None


class CustomerCreate(CustomerBase):
    phone: str = Field(min_length=1, max_length=50)


class CustomerUpdate(BaseModel):
    company_name: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    country_region: str | None = None
    assigned_user_id: str | None = None
    stage: str | None = None
    group_name: str | None = None
    tags: dict | None = None
    score: int | None = None
    notes: str | None = None
    last_contact_date: datetime | None = None
    type: str | None = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    last_contact_date: datetime | None
    created_at: datetime
    updated_at: datetime


class CustomerProfileResponse(BaseModel):
    customer: CustomerOut
    related_leads: list["LeadOut"]
    lead_intelligence: list[CustomerLeadIntelligence] = Field(default_factory=list)
    preference_history: list[CustomerPreferenceOut] = Field(default_factory=list)
    conversation_count: int = 0
    ai_summary: str | None = None
    trust_level: str | None = None


from app.schemas.lead import LeadOut  # noqa: E402


CustomerProfileResponse.model_rebuild()


class CustomerListResponse(BaseModel):
    data: list[CustomerOut]
    meta: PaginationMeta
