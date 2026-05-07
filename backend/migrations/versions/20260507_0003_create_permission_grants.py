"""Create permission_grants table.

Revision ID: 20260507_0003
Revises: 20260507_0002
Create Date: 2026-05-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260507_0003"
down_revision = "20260507_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "permission_grants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("permission_key", sa.String(length=120), nullable=False),
        sa.Column("is_allowed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_permission_grants_workspace_id"), "permission_grants", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_permission_grants_user_id"), "permission_grants", ["user_id"], unique=False)
    op.create_index(op.f("ix_permission_grants_permission_key"), "permission_grants", ["permission_key"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_permission_grants_permission_key"), table_name="permission_grants")
    op.drop_index(op.f("ix_permission_grants_user_id"), table_name="permission_grants")
    op.drop_index(op.f("ix_permission_grants_workspace_id"), table_name="permission_grants")
    op.drop_table("permission_grants")
