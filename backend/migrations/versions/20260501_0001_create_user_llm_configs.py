"""create user llm configs

Revision ID: 20260501_0001
Revises: 20260428_0001
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260501_0001"
down_revision: Union[str, None] = "20260428_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_llm_configs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("encrypted_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model_preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("automation_modes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("default_model", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_llm_configs_workspace_id", "user_llm_configs", ["workspace_id"])
    op.create_index("ix_user_llm_configs_user_id", "user_llm_configs", ["user_id"])
    op.create_index("ix_user_llm_configs_provider", "user_llm_configs", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_user_llm_configs_provider", table_name="user_llm_configs")
    op.drop_index("ix_user_llm_configs_user_id", table_name="user_llm_configs")
    op.drop_index("ix_user_llm_configs_workspace_id", table_name="user_llm_configs")
    op.drop_table("user_llm_configs")