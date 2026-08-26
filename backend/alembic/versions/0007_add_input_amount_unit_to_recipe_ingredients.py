"""add input_amount and input_unit columns to recipe_ingredients

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # input_unit has one constant value for every existing row, so a server_default
    # backfills it in place (same pattern as 0005's recipes.servings) and stays as
    # the column's permanent default for future inserts.
    op.add_column(
        "recipe_ingredients",
        sa.Column("input_unit", sa.Text(), nullable=False, server_default="g"),
    )

    # input_amount has no single constant value -- pre-existing rows must inherit
    # grams (the value they were already keyed in) -- so it's added nullable,
    # backfilled row-by-row from the existing grams column, then locked to NOT NULL.
    op.add_column(
        "recipe_ingredients",
        sa.Column("input_amount", sa.Numeric(), nullable=True),
    )
    op.execute("UPDATE recipe_ingredients SET input_amount = grams")
    op.alter_column("recipe_ingredients", "input_amount", nullable=False)


def downgrade() -> None:
    op.drop_column("recipe_ingredients", "input_amount")
    op.drop_column("recipe_ingredients", "input_unit")
