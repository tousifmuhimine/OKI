"""Add lead share links and org share settings.

Revision ID: 20260521_0001
Revises: 20260514_0001
Create Date: 2026-05-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260521_0001"
down_revision = "20260514_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("allow_public_shares", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("organizations", sa.Column("default_share_expiry_days", sa.Integer(), nullable=True))

    op.create_table(
        "lead_share_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lead_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("allowed_emails", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(op.f("ix_lead_share_links_lead_id"), "lead_share_links", ["lead_id"], unique=False)
    op.create_index(op.f("ix_lead_share_links_token"), "lead_share_links", ["token"], unique=True)
    op.create_index(op.f("ix_lead_share_links_expires_at"), "lead_share_links", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_share_links_expires_at"), table_name="lead_share_links")
    op.drop_index(op.f("ix_lead_share_links_token"), table_name="lead_share_links")
    op.drop_index(op.f("ix_lead_share_links_lead_id"), table_name="lead_share_links")
    op.drop_table("lead_share_links")

    op.drop_column("organizations", "default_share_expiry_days")
    op.drop_column("organizations", "allow_public_shares")
