import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.database import AsyncSessionLocal
from app.models.product import Product

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30
_PURGE_INTERVAL_SECONDS = 60 * 60


async def purge_expired_soft_deletes() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(Product).where(Product.deleted_at.is_not(None), Product.deleted_at < cutoff)
        )
        await db.commit()
        return result.rowcount or 0


async def run_purge_loop() -> None:
    while True:
        try:
            deleted = await purge_expired_soft_deletes()
            if deleted:
                logger.info("Purged %d soft-deleted product(s) past the %d-day retention window", deleted, RETENTION_DAYS)
        except Exception:
            logger.exception("Soft-delete purge job failed")
        await asyncio.sleep(_PURGE_INTERVAL_SECONDS)
