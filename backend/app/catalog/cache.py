"""Postgres-backed cache for OFF responses (no Redis in the stack). Shared by
all users, so no user_id / soft delete."""
import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogProduct, CatalogSearchCache

HIT_TTL = timedelta(days=7)
MISS_TTL = timedelta(hours=24)  # negative cache: repeated scans of an unknown code are free
SEARCH_TTL = timedelta(hours=24)
# Expired hits are kept this long so they can still be served if OFF is down.
STALE_HIT_RETENTION = timedelta(days=30)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def product_is_fresh(row: CatalogProduct) -> bool:
    return _now() - row.fetched_at < (HIT_TTL if row.found else MISS_TTL)


def search_is_fresh(row: CatalogSearchCache) -> bool:
    return _now() - row.fetched_at < SEARCH_TTL


def search_key(q: str, langs: str, page: int) -> str:
    normalized = " ".join(q.lower().split())
    return hashlib.sha256(f"{normalized}|{langs}|{page}".encode()).hexdigest()


async def get_product_row(db: AsyncSession, code: str) -> CatalogProduct | None:
    return await db.get(CatalogProduct, code)


async def store_product(db: AsyncSession, code: str, payload: dict | None) -> None:
    values = {"code": code, "payload": payload, "found": payload is not None, "fetched_at": _now()}
    stmt = insert(CatalogProduct).values(**values)
    await db.execute(stmt.on_conflict_do_update(index_elements=["code"], set_=values))
    await db.commit()


async def get_search_row(db: AsyncSession, key: str) -> CatalogSearchCache | None:
    return await db.get(CatalogSearchCache, key)


async def store_search(db: AsyncSession, key: str, payload: dict) -> None:
    values = {"key": key, "payload": payload, "fetched_at": _now()}
    stmt = insert(CatalogSearchCache).values(**values)
    await db.execute(stmt.on_conflict_do_update(index_elements=["key"], set_=values))
    await db.commit()


async def purge_expired(db: AsyncSession) -> int:
    now = _now()
    total = 0
    for stmt in (
        delete(CatalogProduct).where(CatalogProduct.found.is_(True), CatalogProduct.fetched_at < now - STALE_HIT_RETENTION),
        delete(CatalogProduct).where(CatalogProduct.found.is_(False), CatalogProduct.fetched_at < now - MISS_TTL),
        delete(CatalogSearchCache).where(CatalogSearchCache.fetched_at < now - SEARCH_TTL),
    ):
        total += (await db.execute(stmt)).rowcount or 0
    await db.commit()
    return total
