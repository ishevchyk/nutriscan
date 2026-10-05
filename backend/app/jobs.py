import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.models.product import Product
from app.models.meal import Meal
from app.models.meal_ingredient import MealIngredient
from app.meal_ingredients import copy_values_to_row, resolve_ingredients

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30
_PURGE_INTERVAL_SECONDS = 60 * 60


async def purge_expired_soft_deletes(session_factory=AsyncSessionLocal) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    async with session_factory() as db:
        # Meal ingredients still following a product about to be purged take
        # their values with them first (they would otherwise lose them when
        # product_id is nulled), so purging never changes a meal's nutrition.
        expiring = select(Product.id).where(Product.deleted_at.is_not(None), Product.deleted_at < cutoff)
        following = (
            await db.execute(
                select(MealIngredient).where(
                    MealIngredient.product_id.in_(expiring), MealIngredient.uses_own_values.is_(False)
                )
            )
        ).scalars().all()
        for ingredient, view in zip(following, await resolve_ingredients(db, following)):
            copy_values_to_row(ingredient, view)
        await db.flush()

        products_result = await db.execute(
            delete(Product).where(Product.deleted_at.is_not(None), Product.deleted_at < cutoff)
        )
        # Meal purge cascades to its own meal_ingredients/meal_portions rows
        # (ondelete="CASCADE"). A meal_ingredients row still linked to a product
        # purged in the statement above is left with product_id set to NULL
        # (ondelete="SET NULL"), not deleted -- its name/macros/grams snapshot is
        # preserved as-is.
        meals_result = await db.execute(
            delete(Meal).where(Meal.deleted_at.is_not(None), Meal.deleted_at < cutoff)
        )
        await db.commit()
        return (products_result.rowcount or 0) + (meals_result.rowcount or 0)


async def run_purge_loop() -> None:
    while True:
        try:
            deleted = await purge_expired_soft_deletes()
            if deleted:
                logger.info(
                    "Purged %d soft-deleted row(s) (products + meals) past the %d-day retention window",
                    deleted,
                    RETENTION_DAYS,
                )
        except Exception:
            logger.exception("Soft-delete purge job failed")
        await asyncio.sleep(_PURGE_INTERVAL_SECONDS)
