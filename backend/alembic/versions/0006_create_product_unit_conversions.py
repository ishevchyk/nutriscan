"""create product_unit_conversions table

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_unit_conversions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("grams_per_unit", sa.Numeric(), nullable=False),
        sa.UniqueConstraint("product_id", "unit", name="ux_product_unit_conversions_product_id_unit"),
    )
    op.create_index("ix_product_unit_conversions_product_id", "product_unit_conversions", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_product_unit_conversions_product_id", table_name="product_unit_conversions")
    op.drop_table("product_unit_conversions")
