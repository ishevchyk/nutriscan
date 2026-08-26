import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models.product import Product
from app.models.meal import Meal

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30
_PURGE_INTERVAL_SECONDS = 60 * 60


async def purge_expired_soft_deletes() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    async with AsyncSessionLocal() as db:
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
