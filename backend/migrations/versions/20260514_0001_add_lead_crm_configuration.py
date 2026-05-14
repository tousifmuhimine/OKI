"""Add lead CRM configuration tables.

Revision ID: 20260514_0001
Revises: 20260507_0003
Create Date: 2026-05-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


revision = "20260514_0001"
down_revision = "20260507_0003"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def _named_active_table(table_name: str) -> None:
    op.create_table(
        table_name,
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f(f"ix_{table_name}_name"), table_name, ["name"], unique=False)
    op.create_index(op.f(f"ix_{table_name}_is_active"), table_name, ["is_active"], unique=False)


def upgrade() -> None:
    op.create_table(
        "lead_sources",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("cost_per_lead", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_lead_sources_name"), "lead_sources", ["name"], unique=False)
    op.create_index(op.f("ix_lead_sources_is_active"), "lead_sources", ["is_active"], unique=False)

    op.create_table(
        "lead_stages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("probability_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_lead_stages_name"), "lead_stages", ["name"], unique=False)
    op.create_index(op.f("ix_lead_stages_position"), "lead_stages", ["position"], unique=False)
    op.create_index(op.f("ix_lead_stages_is_closed"), "lead_stages", ["is_closed"], unique=False)
    op.create_index(op.f("ix_lead_stages_is_active"), "lead_stages", ["is_active"], unique=False)

    _named_active_table("lead_sectors")
    _named_active_table("lead_areas")
    _named_active_table("lead_professions")

    op.add_column("leads", sa.Column("lead_source_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("lead_stage_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("lead_sector_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("lead_area_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("lead_profession_id", sa.String(length=36), nullable=True))
    op.add_column("leads", sa.Column("priority", sa.String(length=32), nullable=False, server_default="medium"))
    op.add_column("leads", sa.Column("untouched", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("leads", sa.Column("ai_instructions", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))

    for column_name in [
        "lead_source_id",
        "lead_stage_id",
        "lead_sector_id",
        "lead_area_id",
        "lead_profession_id",
        "priority",
        "untouched",
    ]:
        op.create_index(op.f(f"ix_leads_{column_name}"), "leads", [column_name], unique=False)

    op.create_foreign_key("fk_leads_lead_source_id", "leads", "lead_sources", ["lead_source_id"], ["id"])
    op.create_foreign_key("fk_leads_lead_stage_id", "leads", "lead_stages", ["lead_stage_id"], ["id"])
    op.create_foreign_key("fk_leads_lead_sector_id", "leads", "lead_sectors", ["lead_sector_id"], ["id"])
    op.create_foreign_key("fk_leads_lead_area_id", "leads", "lead_areas", ["lead_area_id"], ["id"])
    op.create_foreign_key("fk_leads_lead_profession_id", "leads", "lead_professions", ["lead_profession_id"], ["id"])

    op.create_table(
        "lead_activities",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lead_id", sa.String(length=36), nullable=False),
        sa.Column("activity_type", sa.String(length=64), nullable=False),
        sa.Column("direction", sa.String(length=32), nullable=True),
        sa.Column("platform", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column_name in [
        "lead_id",
        "activity_type",
        "direction",
        "platform",
        "due_at",
        "completed_at",
        "created_by_user_id",
    ]:
        op.create_index(op.f(f"ix_lead_activities_{column_name}"), "lead_activities", [column_name], unique=False)

    bind = op.get_bind()

    source_ids: dict[str, str] = {}
    for name in ["Manual", "Website", "Facebook", "WhatsApp", "Referral"]:
        item_id = str(uuid.uuid4())
        source_ids[name.lower()] = item_id
        bind.execute(
            sa.text(
                "insert into lead_sources (id, name, cost_per_lead, is_active) "
                "values (:id, :name, 0, true) on conflict (name) do nothing"
            ),
            {"id": item_id, "name": name},
        )

    stage_rows = [
        ("New", 10, 1, False),
        ("Contacted", 20, 2, False),
        ("Interested", 35, 3, False),
        ("Qualified", 55, 4, False),
        ("Proposal", 75, 5, False),
        ("Won", 100, 6, True),
        ("Lost", 0, 7, True),
    ]
    stage_ids: dict[str, str] = {}
    for name, probability, position, is_closed in stage_rows:
        item_id = str(uuid.uuid4())
        stage_ids[name.lower().replace(" ", "_")] = item_id
        bind.execute(
            sa.text(
                "insert into lead_stages (id, name, probability_percent, position, is_closed, is_active) "
                "values (:id, :name, :probability, :position, :is_closed, true) on conflict (name) do nothing"
            ),
            {
                "id": item_id,
                "name": name,
                "probability": probability,
                "position": position,
                "is_closed": is_closed,
            },
        )

    for table_name, names in {
        "lead_sectors": ["Technology", "Real Estate", "Ecommerce", "Education", "Manufacturing"],
        "lead_areas": ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna"],
        "lead_professions": ["Business Owner", "Banker", "Engineer", "Doctor", "Student"],
    }.items():
        for name in names:
            bind.execute(
                sa.text(
                    f"insert into {table_name} (id, name, is_active) "
                    "values (:id, :name, true) on conflict (name) do nothing"
                ),
                {"id": str(uuid.uuid4()), "name": name},
            )

    bind.execute(
        sa.text(
            """
            update leads
            set lead_source_id = lead_sources.id
            from lead_sources
            where leads.lead_source_id is null
              and lower(coalesce(leads.source, 'manual')) = lower(lead_sources.name)
            """
        )
    )
    bind.execute(
        sa.text(
            """
            update leads
            set lead_stage_id = lead_stages.id
            from lead_stages
            where leads.lead_stage_id is null
              and lower(replace(coalesce(leads.status, 'new'), '_', ' ')) = lower(lead_stages.name)
            """
        )
    )
    bind.execute(sa.text("update leads set priority = 'medium' where priority is null or priority = ''"))


def downgrade() -> None:
    for column_name in [
        "created_by_user_id",
        "completed_at",
        "due_at",
        "platform",
        "direction",
        "activity_type",
        "lead_id",
    ]:
        op.drop_index(op.f(f"ix_lead_activities_{column_name}"), table_name="lead_activities")
    op.drop_table("lead_activities")

    for fk_name in [
        "fk_leads_lead_profession_id",
        "fk_leads_lead_area_id",
        "fk_leads_lead_sector_id",
        "fk_leads_lead_stage_id",
        "fk_leads_lead_source_id",
    ]:
        op.drop_constraint(fk_name, "leads", type_="foreignkey")

    for column_name in [
        "untouched",
        "priority",
        "lead_profession_id",
        "lead_area_id",
        "lead_sector_id",
        "lead_stage_id",
        "lead_source_id",
    ]:
        op.drop_index(op.f(f"ix_leads_{column_name}"), table_name="leads")

    for column_name in [
        "tags",
        "ai_instructions",
        "untouched",
        "priority",
        "lead_profession_id",
        "lead_area_id",
        "lead_sector_id",
        "lead_stage_id",
        "lead_source_id",
    ]:
        op.drop_column("leads", column_name)

    for table_name in ["lead_professions", "lead_areas", "lead_sectors"]:
        op.drop_index(op.f(f"ix_{table_name}_is_active"), table_name=table_name)
        op.drop_index(op.f(f"ix_{table_name}_name"), table_name=table_name)
        op.drop_table(table_name)

    op.drop_index(op.f("ix_lead_stages_is_active"), table_name="lead_stages")
    op.drop_index(op.f("ix_lead_stages_is_closed"), table_name="lead_stages")
    op.drop_index(op.f("ix_lead_stages_position"), table_name="lead_stages")
    op.drop_index(op.f("ix_lead_stages_name"), table_name="lead_stages")
    op.drop_table("lead_stages")

    op.drop_index(op.f("ix_lead_sources_is_active"), table_name="lead_sources")
    op.drop_index(op.f("ix_lead_sources_name"), table_name="lead_sources")
    op.drop_table("lead_sources")
