from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class CustomerBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    contact_person: str | None = None
    country_region: str | None = None
    assigned_user_id: str | None = None
    stage: str = "new"
    group_name: str | None = None
    tags: dict = Field(default_factory=dict)
    score: int = 0
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_name: str | None = None
    contact_person: str | None = None
    country_region: str | None = None
    assigned_user_id: str | None = None
    stage: str | None = None
    group_name: str | None = None
    tags: dict | None = None
    score: int | None = None
    notes: str | None = None
    last_contact_date: datetime | None = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    last_contact_date: datetime | None
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    data: list[CustomerOut]
    meta: PaginationMeta
