from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class LeadBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    contact_person: str | None = None
    source: str | None = None
    status: str = "new"
    assigned_user_id: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    converted_customer_id: str | None
    created_at: datetime
    updated_at: datetime


class LeadListResponse(BaseModel):
    data: list[LeadOut]
    meta: PaginationMeta
