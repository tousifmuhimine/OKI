"""create inbox tables

Revision ID: 20260428_0001
Revises: None
Create Date: 2026-04-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260428_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


channel_type = postgresql.ENUM(
    "facebook",
    "instagram",
    "whatsapp",
    "email",
    "website",
    "api",
    name="channel_type",
    create_type=False,
)
conversation_status = postgresql.ENUM(
    "open",
    "resolved",
    "pending",
    name="conversation_status",
    create_type=False,
)
message_type = postgresql.ENUM(
    "incoming",
    "outgoing",
    name="message_type",
    create_type=False,
)
sender_type = postgresql.ENUM(
    "contact",
    "agent",
    name="sender_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    channel_type.create(bind, checkfirst=True)
    conversation_status.create(bind, checkfirst=True)
    message_type.create(bind, checkfirst=True)
    sender_type.create(bind, checkfirst=True)

    op.create_table(
        "inboxes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("channel_type", channel_type, nullable=False),
        sa.Column("channel_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inboxes_workspace_id", "inboxes", ["workspace_id"])
    op.create_index("ix_inboxes_channel_type", "inboxes", ["channel_type"])

    op.create_table(
        "contacts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("channel_identifiers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contacts_workspace_id", "contacts", ["workspace_id"])
    op.create_index("ix_contacts_email", "contacts", ["email"])
    op.create_index("ix_contacts_phone", "contacts", ["phone"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("inbox_id", sa.String(length=36), nullable=False),
        sa.Column("contact_id", sa.String(length=36), nullable=False),
        sa.Column("status", conversation_status, nullable=False),
        sa.Column("channel_type", channel_type, nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"]),
        sa.ForeignKeyConstraint(["inbox_id"], ["inboxes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversations_workspace_id", "conversations", ["workspace_id"])
    op.create_index("ix_conversations_inbox_id", "conversations", ["inbox_id"])
    op.create_index("ix_conversations_contact_id", "conversations", ["contact_id"])
    op.create_index("ix_conversations_status", "conversations", ["status"])
    op.create_index("ix_conversations_channel_type", "conversations", ["channel_type"])

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", message_type, nullable=False),
        sa.Column("sender_type", sender_type, nullable=False),
        sa.Column("sender_id", sa.String(length=255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_message_type", "messages", ["message_type"])
    op.create_index("ix_messages_sender_type", "messages", ["sender_type"])


def downgrade() -> None:
    op.drop_index("ix_messages_sender_type", table_name="messages")
    op.drop_index("ix_messages_message_type", table_name="messages")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_conversations_channel_type", table_name="conversations")
    op.drop_index("ix_conversations_status", table_name="conversations")
    op.drop_index("ix_conversations_contact_id", table_name="conversations")
    op.drop_index("ix_conversations_inbox_id", table_name="conversations")
    op.drop_index("ix_conversations_workspace_id", table_name="conversations")
    op.drop_table("conversations")

    op.drop_index("ix_contacts_phone", table_name="contacts")
    op.drop_index("ix_contacts_email", table_name="contacts")
    op.drop_index("ix_contacts_workspace_id", table_name="contacts")
    op.drop_table("contacts")

    op.drop_index("ix_inboxes_channel_type", table_name="inboxes")
    op.drop_index("ix_inboxes_workspace_id", table_name="inboxes")
    op.drop_table("inboxes")

    sender_type.drop(op.get_bind(), checkfirst=True)
    message_type.drop(op.get_bind(), checkfirst=True)
    conversation_status.drop(op.get_bind(), checkfirst=True)
    channel_type.drop(op.get_bind(), checkfirst=True)
