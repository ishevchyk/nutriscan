"""extended nutrition (saturated_fat, nutrients, product_nutrients) and product_portions

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.nutrient_catalog import NUTRIENT_SEED

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("saturated_fat", sa.Float(), nullable=True))

    nutrients = op.create_table(
        "nutrients",
        sa.Column("code", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("unit", sa.String(10), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("parent_code", sa.String(50), nullable=True),
        sa.Column("nrv", sa.Float(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
    )
    op.bulk_insert(
        nutrients,
        [
            {"code": c, "name": n, "unit": u, "category": cat, "parent_code": parent, "nrv": nrv, "sort_order": i}
            for i, (c, n, u, cat, parent, nrv) in enumerate(NUTRIENT_SEED)
        ],
    )

    op.create_table(
        "product_nutrients",
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("nutrient_code", sa.String(50), sa.ForeignKey("nutrients.code"), primary_key=True),
        sa.Column("amount", sa.Float(), nullable=False),
    )

    op.create_table(
        "product_portions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("grams", sa.Float(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_product_portions_product_id", "product_portions", ["product_id"])
    op.create_index(
        "uq_product_portions_default",
        "product_portions",
        ["product_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )

    # serving_size/serving_unit were never exposed in any UI; where they hold a
    # gram amount they become the product's default portion. Other units
    # (cups, pieces, ...) can't be converted to grams without a conversion, so
    # those rows are left in place on the product untouched.
    op.execute(
        """
        INSERT INTO product_portions (id, product_id, name, grams, is_default)
        SELECT gen_random_uuid(), id, trim(trailing '.' FROM trim(trailing '0' FROM serving_size::numeric(10,2)::text)) || ' g', serving_size, true
        FROM products
        WHERE serving_size IS NOT NULL AND serving_size > 0
          AND lower(coalesce(serving_unit, 'g')) IN ('g', 'gram', 'grams')
        """
    )


def downgrade() -> None:
    op.drop_table("product_portions")
    op.drop_table("product_nutrients")
    op.drop_table("nutrients")
    op.drop_column("products", "saturated_fat")
