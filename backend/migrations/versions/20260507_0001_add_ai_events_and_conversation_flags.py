"""Add ai_events table and conversation flags for bot pause / assignment.

Revision ID: 20260507_0001
Revises: 20260506_0005
Create Date: 2026-05-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260507_0001"
down_revision = "20260506_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # add conversation flags
    op.add_column("conversations", sa.Column("is_bot_paused", sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column("conversations", sa.Column("assigned_user_id", sa.String(length=36), nullable=True))
    op.create_index(op.f("ix_conversations_assigned_user_id"), "conversations", ["assigned_user_id"], unique=False)

    # create ai_events table
    op.create_table(
        "ai_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_events_conversation_id", "ai_events", ["conversation_id"])
    op.create_index("ix_ai_events_event_type", "ai_events", ["event_type"])


def downgrade() -> None:
    op.drop_index("ix_ai_events_event_type", table_name="ai_events")
    op.drop_index("ix_ai_events_conversation_id", table_name="ai_events")
    op.drop_table("ai_events")

    op.drop_index(op.f("ix_conversations_assigned_user_id"), table_name="conversations")
    op.drop_column("conversations", "assigned_user_id")
    op.drop_column("conversations", "is_bot_paused")
