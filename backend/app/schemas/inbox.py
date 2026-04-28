from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PaginationMeta


ChannelType = Literal["facebook", "instagram", "whatsapp", "email", "website", "api"]
ConversationStatus = Literal["open", "resolved", "pending"]
MessageType = Literal["incoming", "outgoing"]
SenderType = Literal["contact", "agent"]


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    channel_identifiers: dict[str, Any] = Field(default_factory=dict)


class ContactOut(ContactCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    created_at: datetime


class ContactListResponse(BaseModel):
    data: list[ContactOut]
    meta: PaginationMeta


class InboxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    name: str
    channel_type: ChannelType
    channel_config: dict[str, Any]
    created_at: datetime


class InboxCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    channel_type: ChannelType
    channel_config: dict[str, Any] = Field(default_factory=dict)


class IntegrationListResponse(BaseModel):
    data: list[InboxOut]
    meta: PaginationMeta


class ConversationOut(BaseModel):
    id: str
    workspace_id: str
    inbox_id: str
    contact_id: str
    status: ConversationStatus
    channel_type: ChannelType
    last_message_at: datetime | None
    created_at: datetime
    contact: ContactOut | None = None
    inbox: InboxOut | None = None
    last_message_preview: str | None = None


class ConversationListResponse(BaseModel):
    data: list[ConversationOut]
    meta: PaginationMeta


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EmailComposeCreate(BaseModel):
    to_email: str = Field(min_length=3, max_length=255)
    to_name: str | None = Field(default=None, max_length=255)
    subject: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    inbox_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    content: str
    message_type: MessageType
    sender_type: SenderType
    sender_id: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class MessageListResponse(BaseModel):
    data: list[MessageOut]
    meta: PaginationMeta


class WebhookAck(BaseModel):
    received: bool = True
