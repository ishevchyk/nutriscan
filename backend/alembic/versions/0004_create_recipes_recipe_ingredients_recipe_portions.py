"""create recipes, recipe_ingredients, recipe_portions tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_recipes_user_id", "recipes", ["user_id"])

    # recipe_ingredients is a self-contained nutrition snapshot with an optional
    # link to a product, not a pure pointer. product_id uses ondelete="SET NULL"
    # (not CASCADE) so purging a linked product just unlinks the ingredient --
    # its name/macros/grams snapshot is preserved as-is.
    op.create_table(
        "recipe_ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(255), nullable=True),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("protein", sa.Float(), nullable=True),
        sa.Column("carbs", sa.Float(), nullable=True),
        sa.Column("fat", sa.Float(), nullable=True),
        sa.Column("fiber", sa.Float(), nullable=True),
        sa.Column("sugar", sa.Float(), nullable=True),
        sa.Column("salt", sa.Float(), nullable=True),
        sa.Column("grams", sa.Float(), nullable=False),
    )
    op.create_index("ix_recipe_ingredients_recipe_id", "recipe_ingredients", ["recipe_id"])
    op.create_index("ix_recipe_ingredients_product_id", "recipe_ingredients", ["product_id"])

    # recipe_portions is hard-deleted (backend/CLAUDE.md's explicit exception to the
    # soft-delete rule), so there is no deleted_at column here.
    op.create_table(
        "recipe_portions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "recipe_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("grams", sa.Float(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recipe_portions_recipe_id", "recipe_portions", ["recipe_id"])
    # Partial unique index enforces "at most one default portion per recipe" at the
    # DB level (chosen over an app-level check for the same race-safety reason
    # ux_groups_user_id_lower_name uses one in 0003 -- single source of truth,
    # no window for a duplicate default to slip in under concurrent writes).
    op.create_index(
        "ux_recipe_portions_recipe_id_default",
        "recipe_portions",
        ["recipe_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )


def downgrade() -> None:
    op.drop_index("ux_recipe_portions_recipe_id_default", table_name="recipe_portions")
    op.drop_index("ix_recipe_portions_recipe_id", table_name="recipe_portions")
    op.drop_table("recipe_portions")

    op.drop_index("ix_recipe_ingredients_product_id", table_name="recipe_ingredients")
    op.drop_index("ix_recipe_ingredients_recipe_id", table_name="recipe_ingredients")
    op.drop_table("recipe_ingredients")

    op.drop_index("ix_recipes_user_id", table_name="recipes")
    op.drop_table("recipes")
