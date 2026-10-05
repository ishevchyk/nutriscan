"""meal_ingredients.uses_own_values: linked ingredients follow the product

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALUES = ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt", "saturated_fat")
TOLERANCE = 1e-6


def _same(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= TOLERANCE


def upgrade() -> None:
    op.add_column(
        "meal_ingredients",
        sa.Column("uses_own_values", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    # Non-destructive switch: a linked ingredient starts following its product
    # only if its stored values already equal the product's current ones, so no
    # meal total changes on upgrade. Ones that differ (hand-edited, or stale
    # after a product edit) stay on their own values. The stored values of
    # followed rows are left in place (ignored), which also keeps a downgrade
    # safe.
    if context.is_offline_mode():
        # --sql output can't run the data backfill below (it needs query results).
        return
    bind = op.get_bind()
    cols = ", ".join(f"mi.{c} AS mi_{c}, p.{c} AS p_{c}" for c in VALUES)
    rows = bind.execute(
        sa.text(
            f"SELECT mi.id AS id, mi.product_id AS product_id, mi.nutrients AS mi_nutrients, {cols} "
            "FROM meal_ingredients mi JOIN products p ON p.id = mi.product_id"
        )
    ).mappings().all()
    product_nutrients: dict = {}
    for pid, code, amount in bind.execute(
        sa.text("SELECT product_id, nutrient_code, amount FROM product_nutrients")
    ):
        product_nutrients.setdefault(pid, {})[code] = amount

    follow_ids = []
    for row in rows:
        if not all(_same(row[f"mi_{c}"], row[f"p_{c}"]) for c in VALUES):
            continue
        own = row["mi_nutrients"] or {}
        theirs = product_nutrients.get(row["product_id"], {})
        if set(own) != set(theirs) or any(not _same(own[k], theirs[k]) for k in own):
            continue
        follow_ids.append(row["id"])
    if follow_ids:
        bind.execute(
            sa.text("UPDATE meal_ingredients SET uses_own_values = false WHERE id = ANY(:ids)"),
            {"ids": follow_ids},
        )


def downgrade() -> None:
    op.drop_column("meal_ingredients", "uses_own_values")
