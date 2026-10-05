from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nutrient import ProductNutrient
from app.models.product import Product
from app.nutrition import MACROS

NUTRITION_KEYS = ("name", "brand", *MACROS, "nutrients")


async def load_product_nutrition(db: AsyncSession, product_ids: Iterable[UUID]) -> dict[UUID, dict]:
    """{product_id: {name, brand, calories..., nutrients}} per 100 g, in the
    shape stored in log_entries.nutrition / log_entry_meal_ingredients.nutrition
    and used to resolve live meal ingredients. Soft-deleted products are
    included on purpose: they stay readable until the purge job removes them.
    Missing ids (already purged) are simply absent from the result."""
    ids = set(product_ids)
    if not ids:
        return {}
    products = (await db.execute(select(Product).where(Product.id.in_(ids)))).scalars().all()
    nutrient_rows = (
        await db.execute(select(ProductNutrient).where(ProductNutrient.product_id.in_(ids)))
    ).scalars().all()
    nutrients: dict[UUID, dict[str, float]] = {}
    for row in nutrient_rows:
        nutrients.setdefault(row.product_id, {})[row.nutrient_code] = row.amount
    return {
        p.id: {
            "name": p.name,
            "brand": p.brand,
            **{macro: getattr(p, macro) for macro in MACROS},
            "nutrients": nutrients.get(p.id) or None,
        }
        for p in products
    }
