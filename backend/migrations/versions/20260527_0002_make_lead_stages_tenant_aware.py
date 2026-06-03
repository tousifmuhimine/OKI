"""make lead stages tenant aware

Revision ID: 20260527_0002
Revises: 82a89a7f27e6
Create Date: 2026-05-27 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260527_0002'
down_revision: Union[str, None] = '82a89a7f27e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add organization_id column to lead_stages
    op.add_column('lead_stages', sa.Column('organization_id', sa.String(length=36), nullable=True))
    op.create_index(op.f('ix_lead_stages_organization_id'), 'lead_stages', ['organization_id'], unique=False)
    op.create_foreign_key('fk_lead_stages_organization_id', 'lead_stages', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE')

    # 2. Drop unique index on name
    op.drop_index('ix_lead_stages_name', table_name='lead_stages')
    
    # 3. Re-create index on name without uniqueness, and unique on (organization_id, name)
    op.create_index(op.f('ix_lead_stages_name'), 'lead_stages', ['name'], unique=False)
    op.create_index('ix_lead_stages_org_name', 'lead_stages', ['organization_id', 'name'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_lead_stages_org_name', table_name='lead_stages')
    op.drop_index(op.f('ix_lead_stages_name'), table_name='lead_stages')
    op.create_index('ix_lead_stages_name', 'lead_stages', ['name'], unique=True)
    
    op.drop_constraint('fk_lead_stages_organization_id', 'lead_stages', type_='foreignkey')
    op.drop_index(op.f('ix_lead_stages_organization_id'), table_name='lead_stages')
    op.drop_column('lead_stages', 'organization_id')
