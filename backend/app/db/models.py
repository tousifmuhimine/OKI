import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def uuid_str() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    contact_person: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    country_region: Mapped[str] = mapped_column(String(120), nullable=True, index=True)
    assigned_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    stage: Mapped[str] = mapped_column(String(64), default="new", index=True)
    group_name: Mapped[str] = mapped_column(String(120), nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, default=dict)
    score: Mapped[int] = mapped_column(default=0)
    last_contact_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    # Company business type: ecommerce, real_estate, study_abroad, etc.
    type: Mapped[str] = mapped_column(String(64), nullable=True, index=True)


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    contact_person: Mapped[str] = mapped_column(String(255), nullable=True)
    source: Mapped[str] = mapped_column(String(120), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(64), default="new", index=True)
    assigned_user_id: Mapped[str] = mapped_column(String(36), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    address: Mapped[str] = mapped_column(Text, nullable=True)
    industry: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    follow_up_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Dynamic industry-specific fields (Real Estate / Study Abroad / Ecommerce)
    industry_data: Mapped[dict] = mapped_column(JSONB, nullable=True, default=None)
    # Original agent input, preserved for auditing
    raw_note: Mapped[str] = mapped_column(Text, nullable=True)
    # Agent who submitted the lead (UUID reference to user table)
    agent_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    contact_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )
    inbox_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("inboxes.id"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id"),
        nullable=True,
        index=True,
    )
    capture_source: Mapped[str] = mapped_column(String(32), nullable=True, index=True)
    converted_customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("customers.id"),
        nullable=True,
    )
    # New dynamic lead fields (Step 2)
    intent: Mapped[str] = mapped_column(Text, nullable=True)
    engagement: Mapped[str] = mapped_column(Text, nullable=True)
    trust_level: Mapped[str] = mapped_column(Text, nullable=True)
    budget_min: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    budget_max: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=True)
    last_summary: Mapped[str] = mapped_column(Text, nullable=True)
    assigned_agent_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)


class Opportunity(Base, TimestampMixin):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    stage: Mapped[str] = mapped_column(String(64), default="clue", index=True)
    estimated_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(120), nullable=True, index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    description: Mapped[str] = mapped_column(Text, nullable=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=True)


class SalesOrder(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), index=True)
    handler_user_id: Mapped[str] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    payment_status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    remark: Mapped[str] = mapped_column(Text, nullable=True)


channel_type_enum = Enum(
    "facebook",
    "instagram",
    "whatsapp",
    "email",
    "website",
    "api",
    name="channel_type",
)

conversation_status_enum = Enum(
    "open",
    "resolved",
    "pending",
    name="conversation_status",
)

message_type_enum = Enum(
    "incoming",
    "outgoing",
    name="message_type",
)

sender_type_enum = Enum(
    "contact",
    "agent",
    name="sender_type",
)


class Inbox(Base):
    __tablename__ = "inboxes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(255))
    channel_type: Mapped[str] = mapped_column(channel_type_enum, index=True)
    channel_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    avatar_url: Mapped[str] = mapped_column(Text, nullable=True)
    channel_identifiers: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    inbox_id: Mapped[str] = mapped_column(String(36), ForeignKey("inboxes.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[str] = mapped_column(String(36), ForeignKey("contacts.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(conversation_status_enum, default="open", index=True)
    channel_type: Mapped[str] = mapped_column(channel_type_enum, index=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    # Handover / bot control
    is_bot_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
    )
    content: Mapped[str] = mapped_column(Text)
    message_type: Mapped[str] = mapped_column(message_type_enum, index=True)
    sender_type: Mapped[str] = mapped_column(sender_type_enum, index=True)
    sender_id: Mapped[str] = mapped_column(String(255), nullable=True)
    message_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class AIEvent(Base, TimestampMixin):
    __tablename__ = "ai_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_by: Mapped[str] = mapped_column(String(36), nullable=True, index=True)


class PlatformMetric(Base, TimestampMixin):
    __tablename__ = "platform_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    channel_type: Mapped[str] = mapped_column(channel_type_enum, index=True)
    metric_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    active_conversations: Mapped[int] = mapped_column(Integer, default=0)
    new_conversations: Mapped[int] = mapped_column(Integer, default=0)
    ai_events_count: Mapped[int] = mapped_column(Integer, default=0)
    handover_count: Mapped[int] = mapped_column(Integer, default=0)
    converted_leads_count: Mapped[int] = mapped_column(Integer, default=0)


class CustomerPreference(Base, TimestampMixin):
    __tablename__ = "customer_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id"), nullable=True, index=True)
    field_name: Mapped[str] = mapped_column(String(120), index=True)
    old_value: Mapped[str] = mapped_column(Text, nullable=True)
    new_value: Mapped[str] = mapped_column(Text, nullable=True)
    detected_from: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    source_message: Mapped[str] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class LeadStageHistory(Base, TimestampMixin):
    __tablename__ = "lead_stage_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id"), index=True)
    old_stage: Mapped[str] = mapped_column(String(64), nullable=True)
    new_stage: Mapped[str] = mapped_column(String(64), nullable=False)
    changed_by_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    change_reason: Mapped[str] = mapped_column(Text, nullable=True)


class AlertRule(Base, TimestampMixin):
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(255))
    rule_type: Mapped[str] = mapped_column(String(64), index=True)
    condition_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    target_channel: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class AlertNotification(Base, TimestampMixin):
    __tablename__ = "alert_notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    alert_rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("alert_rules.id"), nullable=True, index=True)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("leads.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(32), default="medium", index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class UserLLMConfig(Base, TimestampMixin):
    __tablename__ = "user_llm_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # encrypted blob holding credentials/config (e.g. api_key)
    encrypted_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    # optional per-platform model preferences, stored as JSON: {"whatsapp":"gpt-1", ...}
    model_preferences: Mapped[dict] = mapped_column(JSONB, default=dict)
    # optional per-platform automation modes: {"whatsapp":"chatbot","email":"manual"}
    automation_modes: Mapped[dict] = mapped_column(JSONB, default=dict)
    default_model: Mapped[str] = mapped_column(String(120), nullable=True)


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)  # 'lead', 'opportunity', 'customer'
    entity_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    assigned_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    priority: Mapped[str] = mapped_column(String(32), default="medium")


class PermissionGrant(Base, TimestampMixin):
    __tablename__ = "permission_grants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    workspace_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    permission_key: Mapped[str] = mapped_column(String(120), index=True)
    is_allowed: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    entity_type: Mapped[str] = mapped_column(String(64), index=True)  # 'lead', 'opportunity', 'customer'
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True) # e.g., 'stage_changed', 'status_updated'
    previous_value: Mapped[dict] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict] = mapped_column(JSONB, nullable=True)
    performed_by_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
