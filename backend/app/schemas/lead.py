from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

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
    lead_source_id: str | None = None
    lead_stage_id: str | None = None
    lead_sector_id: str | None = None
    lead_area_id: str | None = None
    lead_profession_id: str | None = None
    priority: str = "medium"
    untouched: bool = True
    ai_instructions: str | None = None
    tags: list[str] | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if isinstance(value, list):
            return [str(item).strip().lower() for item in value if str(item).strip()]
        if isinstance(value, dict):
            raw = value.get("values") if "values" in value else []
            if isinstance(raw, list):
                return [str(item).strip().lower() for item in raw if str(item).strip()]
            return []
        if isinstance(value, str) and value.strip():
            return [value.strip().lower()]
        return []


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
    lead_source_id: str | None = None
    lead_stage_id: str | None = None
    lead_sector_id: str | None = None
    lead_area_id: str | None = None
    lead_profession_id: str | None = None
    priority: str | None = None
    untouched: bool | None = None
    ai_instructions: str | None = None
    tags: list[str] | None = None


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


class LeadConfigBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    is_active: bool = True


class LeadSourceCreate(LeadConfigBase):
    cost_per_lead: float = 0


class LeadSourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    cost_per_lead: float | None = None
    is_active: bool | None = None


class LeadSourceOut(LeadConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    cost_per_lead: float
    created_at: datetime
    updated_at: datetime


class LeadStageCreate(LeadConfigBase):
    probability_percent: int = Field(default=0, ge=0, le=100)
    position: int = 0
    is_closed: bool = False


class LeadStageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    probability_percent: int | None = Field(default=None, ge=0, le=100)
    position: int | None = None
    is_closed: bool | None = None
    is_active: bool | None = None


class LeadStageOut(LeadConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    probability_percent: int
    position: int
    is_closed: bool
    created_at: datetime
    updated_at: datetime


class LeadNamedConfigCreate(LeadConfigBase):
    pass


class LeadNamedConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None


class LeadNamedConfigOut(LeadConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class LeadActivityBase(BaseModel):
    activity_type: str = Field(min_length=1, max_length=64)
    direction: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict | None = Field(
        default=None,
        validation_alias=AliasChoices("metadata", "activity_metadata"),
        serialization_alias="metadata",
    )


class LeadActivityCreate(LeadActivityBase):
    pass


class LeadActivityUpdate(BaseModel):
    activity_type: str | None = Field(default=None, min_length=1, max_length=64)
    direction: str | None = Field(default=None, max_length=32)
    platform: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=255)
    content: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    due_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict | None = None


class LeadActivityOut(LeadActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lead_id: str
    created_by_user_id: str | None
    created_at: datetime
    updated_at: datetime


class LeadTimelineItem(BaseModel):
    id: str
    item_type: str
    activity_type: str | None = None
    direction: str | None = None
    platform: str | None = None
    title: str | None = None
    content: str | None = None
    created_by_user_id: str | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
