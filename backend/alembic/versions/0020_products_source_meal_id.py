"""add products.source_meal_id (meal converted to product)

Revision ID: 0020
Revises: 0019
Create Date: 2026-11-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "source_meal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("meals.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_products_source_meal_id", "products", ["source_meal_id"])


def downgrade() -> None:
    op.drop_index("ix_products_source_meal_id", table_name="products")
    op.drop_column("products", "source_meal_id")
