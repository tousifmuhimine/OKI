"""link leads to inbox context

Revision ID: 20260501_0002
Revises: 20260428_0001
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260501_0002"
down_revision: Union[str, None] = "20260428_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("contact_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("inbox_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("conversation_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("capture_source", sa.String(length=32), nullable=True))

    op.create_index("ix_leads_contact_id", "leads", ["contact_id"])
    op.create_index("ix_leads_inbox_id", "leads", ["inbox_id"])
    op.create_index("ix_leads_conversation_id", "leads", ["conversation_id"])
    op.create_index("ix_leads_capture_source", "leads", ["capture_source"])

    op.create_foreign_key("fk_leads_contact_id_contacts", "leads", "contacts", ["contact_id"], ["id"])
    op.create_foreign_key("fk_leads_inbox_id_inboxes", "leads", "inboxes", ["inbox_id"], ["id"])
    op.create_foreign_key("fk_leads_conversation_id_conversations", "leads", "conversations", ["conversation_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_leads_conversation_id_conversations", "leads", type_="foreignkey")
    op.drop_constraint("fk_leads_inbox_id_inboxes", "leads", type_="foreignkey")
    op.drop_constraint("fk_leads_contact_id_contacts", "leads", type_="foreignkey")

    op.drop_index("ix_leads_capture_source", table_name="leads")
    op.drop_index("ix_leads_conversation_id", table_name="leads")
    op.drop_index("ix_leads_inbox_id", table_name="leads")
    op.drop_index("ix_leads_contact_id", table_name="leads")

    op.drop_column("leads", "capture_source")
    op.drop_column("leads", "conversation_id")
    op.drop_column("leads", "inbox_id")
    op.drop_column("leads", "contact_id")
