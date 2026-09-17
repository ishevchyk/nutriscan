"""create user_goals, log_entries, log_entry_meal_ingredients tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_goals is a single overwritten row per user, no history (README §6,
    # Open Question #7 pending) -- the unique index on user_id both enforces
    # that and gives PATCH /goals a race-safe upsert target.
    op.create_table(
        "user_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("calories_goal", sa.Numeric(), nullable=True),
        sa.Column("protein_goal", sa.Numeric(), nullable=True),
        sa.Column("fat_goal", sa.Numeric(), nullable=True),
        sa.Column("carbs_goal", sa.Numeric(), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_id", name="ux_user_goals_user_id"),
    )

    # log_entries is hard-deleted (backend/CLAUDE.md's explicit exception to the
    # soft-delete rule), so there is no deleted_at column here. product_id/meal_id/
    # portion_id use ondelete="SET NULL" rather than CASCADE: products and meals are
    # eventually hard-purged by the retention job (app/jobs.py) and meal_portions is
    # hard-deleted on demand, but a log entry is a historical record that should
    # survive any of those -- it just loses the informational back-link (macros for
    # source_type='meal' come from the log_entry_meal_ingredients snapshot below, not
    # a live meal/product reference, so losing the link doesn't affect past totals).
    op.create_table(
        "log_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meal_slot", sa.String(20), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column(
            "product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("quantity_grams", sa.Numeric(), nullable=True),
        sa.Column(
            "meal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meals.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column(
            "portion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("meal_portions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("manual_calories", sa.Numeric(), nullable=True),
        sa.Column("manual_protein", sa.Numeric(), nullable=True),
        sa.Column("manual_fat", sa.Numeric(), nullable=True),
        sa.Column("manual_carbs", sa.Numeric(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Composite index supports GET /log and /log/summary's per-user, per-day range scan.
    op.create_index("ix_log_entries_user_id_logged_at", "log_entries", ["user_id", "logged_at"])

    # log_entry_meal_ingredients is a snapshot taken once at log time, only
    # populated when log_entries.source_type = 'meal' -- editing grams here never
    # touches the meal's own meal_ingredients (README §6). product_id is
    # ondelete="SET NULL" for the same eventual-purge reason as log_entries above;
    # the macro calc treats a null product_id as contributing zero macros.
    op.create_table(
        "log_entry_meal_ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "log_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("log_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("grams", sa.Numeric(), nullable=False),
    )
    op.create_index(
        "ix_log_entry_meal_ingredients_log_entry_id", "log_entry_meal_ingredients", ["log_entry_id"]
    )
    op.create_index(
        "ix_log_entry_meal_ingredients_product_id", "log_entry_meal_ingredients", ["product_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_log_entry_meal_ingredients_product_id", table_name="log_entry_meal_ingredients")
    op.drop_index("ix_log_entry_meal_ingredients_log_entry_id", table_name="log_entry_meal_ingredients")
    op.drop_table("log_entry_meal_ingredients")

    op.drop_index("ix_log_entries_user_id_logged_at", table_name="log_entries")
    op.drop_table("log_entries")

    op.drop_table("user_goals")
