"""
add manual entry fields to leads

Revision ID: 20260506_0003
Revises: 20260501_0003
Create Date: 2026-05-06 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260506_0003'
down_revision = '20260501_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('leads', sa.Column('phone', sa.String(length=64), nullable=True))
    op.add_column('leads', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('leads', sa.Column('industry', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_leads_phone'), 'leads', ['phone'], unique=False)
    op.create_index(op.f('ix_leads_industry'), 'leads', ['industry'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_leads_industry'), table_name='leads')
    op.drop_index(op.f('ix_leads_phone'), table_name='leads')
    op.drop_column('leads', 'industry')
    op.drop_column('leads', 'address')
    op.drop_column('leads', 'phone')
