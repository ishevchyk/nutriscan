"""Cache-aware access to OFF: fresh cache -> OFF -> stale cache on failure."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import cache
from app.catalog.errors import CatalogError
from app.catalog.off_client import OffClient


async def lookup_product(db: AsyncSession, client: OffClient, code: str) -> dict | None:
    """Raw OFF product for a normalized barcode, or None if OFF doesn't know it.
    Raises CatalogBusy / CatalogUnavailable only when there is nothing usable
    (not even a stale hit) in the cache."""
    row = await cache.get_product_row(db, code)
    if row is not None and cache.product_is_fresh(row):
        return row.payload if row.found else None
    try:
        payload = await client.fetch_product(code)
    except CatalogError:
        if row is not None and row.found:
            return row.payload  # stale hit beats an error
        raise
    await cache.store_product(db, code, payload)
    return payload


async def search_products(db: AsyncSession, client: OffClient, q: str, page: int, langs: str = "en") -> dict:
    key = cache.search_key(q, langs, page)
    row = await cache.get_search_row(db, key)
    if row is not None and cache.search_is_fresh(row):
        return row.payload
    try:
        result = await client.search(q, page, langs=langs)
    except CatalogError:
        if row is not None:
            return row.payload
        raise
    await cache.store_search(db, key, result)
    return result
