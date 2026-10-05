"""add saturated_fat and nutrients snapshot to meal_ingredients

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meal_ingredients", sa.Column("saturated_fat", sa.Float(), nullable=True))
    # {"vitamin-c": 8.7, ...} per 100 g, copied from product_nutrients at link
    # time. Snapshots are summed, never filtered on, so JSONB fits here.
    op.add_column("meal_ingredients", sa.Column("nutrients", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("meal_ingredients", "nutrients")
    op.drop_column("meal_ingredients", "saturated_fat")
