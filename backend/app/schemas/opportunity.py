from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginationMeta


class OpportunityCreate(BaseModel):
    customer_id: str
    title: str
    stage: str = "discovery"
    estimated_value: Decimal = Decimal("0.00")
    currency: str = "BDT"


class OpportunityUpdate(BaseModel):
    title: str | None = None
    stage: str | None = None
    estimated_value: Decimal | None = None
    currency: str | None = None


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    title: str
    stage: str
    estimated_value: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime


class OpportunityListResponse(BaseModel):
    data: list[OpportunityOut]
    meta: PaginationMeta


class PipelineStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    position: int
    is_closed: bool
    probability_percent: int


class PipelineOut(BaseModel):
    id: str
    name: str
    stages: list[PipelineStageOut]
