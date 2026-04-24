from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginationMeta


class OrderCreate(BaseModel):
    customer_id: str
    handler_user_id: str | None = None
    status: str = "draft"
    payment_status: str = "pending"
    total_amount: Decimal = Decimal("0.00")
    currency: str = "USD"
    remark: str | None = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    handler_user_id: str | None
    status: str
    payment_status: str
    total_amount: Decimal
    currency: str
    remark: str | None
    created_at: datetime
    updated_at: datetime


class OrderListResponse(BaseModel):
    data: list[OrderOut]
    meta: PaginationMeta
