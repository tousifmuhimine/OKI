"""Pydantic schemas for alert notifications."""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import PaginationMeta


class NotificationOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    message: str
    severity: str
    alert_rule_id: str | None = None
    conversation_id: str | None = None
    lead_id: str | None = None
    payload: dict = {}
    delivered_at: datetime
    read_at: datetime | None = None

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    data: list[NotificationOut]
    meta: PaginationMeta


class UnreadCountResponse(BaseModel):
    unread_count: int
