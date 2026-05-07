"""add company type to customers

Revision ID: 20260506_0004
Revises: 20260506_0003
Create Date: 2026-05-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260506_0004'
down_revision = '20260506_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('type', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_customers_type'), 'customers', ['type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_customers_type'), table_name='customers')
    op.drop_column('customers', 'type')
