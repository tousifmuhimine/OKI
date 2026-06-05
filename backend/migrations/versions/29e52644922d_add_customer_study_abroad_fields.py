"""add customer study abroad fields

Revision ID: 29e52644922d
Revises: e6172ef51a77
Create Date: 2026-06-05 21:41:11.520295
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



from sqlalchemy.dialects import postgresql

revision: str = '29e52644922d'
down_revision: Union[str, None] = 'e6172ef51a77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("last_education", sa.String(length=255), nullable=True))
    op.add_column("customers", sa.Column("countries_applied", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")))


def downgrade() -> None:
    op.drop_column("customers", "countries_applied")
    op.drop_column("customers", "last_education")
