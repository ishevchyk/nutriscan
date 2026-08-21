"""add servings column to recipes

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default backfills existing rows and stays in place permanently,
    # matching the model's server_default="1".
    op.add_column(
        "recipes",
        sa.Column("servings", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("recipes", "servings")
