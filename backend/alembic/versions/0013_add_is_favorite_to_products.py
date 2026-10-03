"""add is_favorite to products

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Per-product flag rather than a separate join table: products are
    # already per-user, so there's no second owner to key a favorite on.
    op.add_column(
        "products",
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("products", "is_favorite")
