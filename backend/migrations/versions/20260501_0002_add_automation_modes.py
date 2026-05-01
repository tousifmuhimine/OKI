"""add automation_modes column to user_llm_configs

Revision ID: 20260501_0002
Revises: 20260501_0001
Create Date: 2026-05-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260501_0002'
down_revision = '20260501_0001'
branch_labels = None
depend_on = None


def upgrade() -> None:
    # add automation_modes JSONB column with default empty object
    op.add_column(
        'user_llm_configs',
        sa.Column('automation_modes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    # remove server_default to keep schema clean
    op.alter_column('user_llm_configs', 'automation_modes', server_default=None)


def downgrade() -> None:
    op.drop_column('user_llm_configs', 'automation_modes')
