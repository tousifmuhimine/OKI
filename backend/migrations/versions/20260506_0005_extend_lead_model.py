"""Extend lead model with dynamic fields.

Revision ID: 20260506_0005
Revises: 20260506_0004
Create Date: 2026-05-06 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260506_0005"
down_revision = "20260506_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("intent", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("engagement", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("trust_level", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("budget_min", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("leads", sa.Column("budget_max", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("leads", sa.Column("last_summary", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("assigned_agent_id", sa.String(length=36), nullable=True))
    op.create_index(op.f("ix_leads_assigned_agent_id"), "leads", ["assigned_agent_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_assigned_agent_id"), table_name="leads")
    op.drop_column("leads", "assigned_agent_id")
    op.drop_column("leads", "last_summary")
    op.drop_column("leads", "budget_max")
    op.drop_column("leads", "budget_min")
    op.drop_column("leads", "trust_level")
    op.drop_column("leads", "engagement")
    op.drop_column("leads", "intent")
