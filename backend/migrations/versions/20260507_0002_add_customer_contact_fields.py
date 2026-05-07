"""Add contact fields to customers.

Revision ID: 20260507_0002
Revises: 20260507_0001
Create Date: 2026-05-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260507_0002"
down_revision = "20260507_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("customers", sa.Column("phone", sa.String(length=64), nullable=True))
    op.add_column("customers", sa.Column("address", sa.Text(), nullable=True))
    op.create_index(op.f("ix_customers_email"), "customers", ["email"], unique=False)
    op.create_index(op.f("ix_customers_phone"), "customers", ["phone"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_customers_phone"), table_name="customers")
    op.drop_index(op.f("ix_customers_email"), table_name="customers")
    op.drop_column("customers", "address")
    op.drop_column("customers", "phone")
    op.drop_column("customers", "email")
