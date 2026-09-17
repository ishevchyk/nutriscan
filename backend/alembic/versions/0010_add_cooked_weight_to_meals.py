"""add cooked_weight_grams column to meals

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Optional override for the per_100g normalization denominator (see
    # app/nutrition.py) -- no meaningful default, stays NULL until a user
    # records the meal's post-cooking weight.
    op.add_column("meals", sa.Column("cooked_weight_grams", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("meals", "cooked_weight_grams")
