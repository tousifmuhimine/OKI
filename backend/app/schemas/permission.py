from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


class PermissionGrantCreate(BaseModel):
    user_id: str = Field(min_length=1)
    permission_key: str = Field(min_length=1, max_length=120)
    is_allowed: bool = True


class PermissionGrantUpdate(BaseModel):
    is_allowed: bool


class PermissionGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: str
    permission_key: str
    is_allowed: bool
    created_at: datetime
    updated_at: datetime


class PermissionPresetApply(BaseModel):
    user_id: str = Field(min_length=1)
    role: str = Field(min_length=1, max_length=32)


class PermissionPresetResponse(BaseModel):
    role: str
    permissions: list[str]


class PermissionGrantListResponse(BaseModel):
    data: list[PermissionGrantOut]
    meta: PaginationMeta
