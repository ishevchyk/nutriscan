"""log entries keep their own nutrition values (frozen at log time)

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-05
"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALUES = ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt", "saturated_fat")


def upgrade() -> None:
    op.add_column("log_entries", sa.Column("nutrition", postgresql.JSONB(), nullable=True))
    op.add_column("log_entry_meal_ingredients", sa.Column("nutrition", postgresql.JSONB(), nullable=True))

    # Backfill from the products' *current* values, which is exactly what
    # totals were computed from until now, so no logged total changes. Rows
    # whose product was already purged (product_id NULL) stay NULL and keep
    # contributing zero, as before.
    if context.is_offline_mode():
        # --sql output can't run the data backfill below (it needs query results).
        return
    bind = op.get_bind()
    snapshots: dict = {}
    for row in bind.execute(sa.text(f"SELECT id, name, brand, {', '.join(VALUES)} FROM products")).mappings():
        snapshots[row["id"]] = {
            "name": row["name"],
            "brand": row["brand"],
            **{c: row[c] for c in VALUES},
            "nutrients": None,
        }
    for pid, code, amount in bind.execute(sa.text("SELECT product_id, nutrient_code, amount FROM product_nutrients")):
        if pid in snapshots:
            snapshots[pid]["nutrients"] = {**(snapshots[pid]["nutrients"] or {}), code: amount}

    for table, where in (
        ("log_entries", "source_type = 'product' AND product_id IS NOT NULL"),
        ("log_entry_meal_ingredients", "product_id IS NOT NULL"),
    ):
        pairs = bind.execute(sa.text(f"SELECT id, product_id FROM {table} WHERE {where}")).all()
        for row_id, product_id in pairs:
            snapshot = snapshots.get(product_id)
            if snapshot is None:
                continue
            bind.execute(
                sa.text(f"UPDATE {table} SET nutrition = CAST(:n AS JSONB) WHERE id = :id"),
                {"n": json.dumps(snapshot), "id": row_id},
            )


def downgrade() -> None:
    op.drop_column("log_entry_meal_ingredients", "nutrition")
    op.drop_column("log_entries", "nutrition")
