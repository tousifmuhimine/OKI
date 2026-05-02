from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import PaginationMeta


class TaskCreate(BaseModel):
    entity_type: str = "event"          # "event" | "lead" | "opportunity" | "customer"
    entity_id: str | None = None
    assigned_user_id: str | None = None
    title: str
    description: str | None = None
    due_date: datetime | None = None
    status: str = "pending"             # "pending" | "done" | "cancelled"
    priority: str = "medium"            # "low" | "medium" | "high"


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    status: str | None = None
    priority: str | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entity_type: str
    entity_id: str | None
    assigned_user_id: str | None
    title: str
    description: str | None
    due_date: datetime | None
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    data: list[TaskOut]
    meta: PaginationMeta
