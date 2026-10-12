from datetime import timedelta

import httpx
import pytest

from app.catalog import cache
from app.catalog.errors import CatalogBusy, CatalogUnavailable
from app.catalog.rate_limit import CircuitBreaker, TokenBucket, UserLimiter
from app.catalog.service import lookup_product, search_products
from app.models.catalog import CatalogProduct
from tests.catalog_helpers import load_fixture, make_client
from tests.conftest import TestSessionLocal

pytestmark = pytest.mark.asyncio(loop_scope="session")

NUTELLA = "3017620422003"


def _ok(request):
    return httpx.Response(200, json=load_fixture("product_nutella"))


async def test_fetch_product_sends_pinned_version_user_agent_fields_and_staging_auth():
    client, seen = make_client(_ok)
    product = await client.fetch_product(NUTELLA)
    assert product["product_name"] == "Nutella"
    req = seen[0]
    assert req.url.host == "world.openfoodfacts.net"
    assert req.url.path == f"/api/v3.4/product/{NUTELLA}"
    assert "nutriments" in req.url.params["fields"]
    assert req.headers["user-agent"] == "NutriScan/0.1.0 (test@example.com)"
    assert req.headers["authorization"].startswith("Basic ")


async def test_production_has_no_basic_auth():
    client, seen = make_client(_ok, off_use_staging=False)
    await client.fetch_product(NUTELLA)
    assert seen[0].url.host == "world.openfoodfacts.org"
    assert "authorization" not in seen[0].headers


async def test_unknown_product_returns_none():
    client, _ = make_client(lambda r: httpx.Response(404, json=load_fixture("product_not_found")))
    assert await client.fetch_product("00000017") is None


@pytest.mark.parametrize("status", [429, 500, 503])
async def test_upstream_errors_become_unavailable_and_trip_breaker(status):
    client, seen = make_client(lambda r: httpx.Response(status))
    with pytest.raises(CatalogUnavailable):
        await client.fetch_product(NUTELLA)
    with pytest.raises(CatalogUnavailable):  # breaker open: no second upstream call
        await client.fetch_product(NUTELLA)
    assert len(seen) == 1


async def test_timeout_becomes_unavailable():
    def boom(request):
        raise httpx.ReadTimeout("slow", request=request)

    client, _ = make_client(boom)
    with pytest.raises(CatalogUnavailable):
        await client.fetch_product(NUTELLA)


async def test_disabled_never_calls_off():
    client, seen = make_client(_ok, off_enabled=False)
    with pytest.raises(CatalogUnavailable):
        await client.fetch_product(NUTELLA)
    assert seen == []


async def test_product_bucket_fails_fast_without_calling_off():
    client, seen = make_client(_ok)
    for _ in range(12):
        await client.fetch_product(NUTELLA)
    with pytest.raises(CatalogBusy) as exc:
        await client.fetch_product(NUTELLA)
    assert exc.value.retry_after >= 1
    assert len(seen) == 12


async def test_search_alicious_parses_hits_and_paging():
    client, seen = make_client(lambda r: httpx.Response(200, json=load_fixture("search_alicious_chocolate")))
    result = await client.search("nutella", 1)
    assert seen[0].url.host == "search.openfoodfacts.org"
    assert seen[0].url.params["q"] == "nutella"
    assert result["hits"] and result["has_more"] is True and result["page"] == 1


async def test_search_legacy_backend():
    client, seen = make_client(
        lambda r: httpx.Response(200, json=load_fixture("search_legacy_nutella")), off_search_backend="legacy"
    )
    result = await client.search("nutella", 1)
    assert seen[0].url.path == "/cgi/search.pl"
    assert result["hits"] and result["has_more"] is True


async def test_token_bucket_refills_over_time():
    now = [0.0]
    bucket = TokenBucket(60, clock=lambda: now[0])
    for _ in range(60):
        bucket.try_acquire()
    with pytest.raises(CatalogBusy):
        bucket.try_acquire()
    now[0] += 2  # 1 token/second
    bucket.try_acquire()
    bucket.try_acquire()
    with pytest.raises(CatalogBusy):
        bucket.try_acquire()


async def test_circuit_breaker_cooldown():
    now = [0.0]
    breaker = CircuitBreaker(60, clock=lambda: now[0])
    assert breaker.remaining() == 0
    breaker.trip()
    assert breaker.remaining() > 0
    now[0] = 61
    assert breaker.remaining() == 0


async def test_user_limiter_sliding_window():
    now = [0.0]
    limiter = UserLimiter(2, clock=lambda: now[0])
    assert limiter.check("u") is None and limiter.check("u") is None
    assert limiter.check("u") >= 1
    assert limiter.check("other") is None
    now[0] = 61
    assert limiter.check("u") is None


# --- cache behaviour (needs the test DB) ---

async def _clear(code):
    async with TestSessionLocal() as db:
        row = await db.get(CatalogProduct, code)
        if row:
            await db.delete(row)
            await db.commit()


async def _age(code, delta):
    async with TestSessionLocal() as db:
        row = await db.get(CatalogProduct, code)
        row.fetched_at = row.fetched_at - delta
        await db.commit()


async def test_cache_miss_then_hit_makes_one_upstream_call():
    await _clear(NUTELLA)
    client, seen = make_client(_ok)
    async with TestSessionLocal() as db:
        first = await lookup_product(db, client, NUTELLA)
        second = await lookup_product(db, client, NUTELLA)
    assert first == second and first["product_name"] == "Nutella"
    assert len(seen) == 1


async def test_negative_cache_prevents_repeat_upstream_calls():
    await _clear("00000017")
    client, seen = make_client(lambda r: httpx.Response(404, json=load_fixture("product_not_found")))
    async with TestSessionLocal() as db:
        assert await lookup_product(db, client, "00000017") is None
        assert await lookup_product(db, client, "00000017") is None
    assert len(seen) == 1


async def test_expired_negative_entry_is_refetched():
    await _clear("00000017")
    client, seen = make_client(lambda r: httpx.Response(404, json=load_fixture("product_not_found")))
    async with TestSessionLocal() as db:
        await lookup_product(db, client, "00000017")
    await _age("00000017", timedelta(hours=25))
    async with TestSessionLocal() as db:
        await lookup_product(db, client, "00000017")
    assert len(seen) == 2


async def test_stale_hit_served_when_off_is_down():
    await _clear(NUTELLA)
    client, _ = make_client(_ok)
    async with TestSessionLocal() as db:
        await lookup_product(db, client, NUTELLA)
    await _age(NUTELLA, timedelta(days=8))
    down, _ = make_client(lambda r: httpx.Response(503))
    async with TestSessionLocal() as db:
        stale = await lookup_product(db, down, NUTELLA)
    assert stale["product_name"] == "Nutella"


async def test_error_with_nothing_cached_propagates():
    await _clear("00000017")
    down, _ = make_client(lambda r: httpx.Response(503))
    async with TestSessionLocal() as db:
        with pytest.raises(CatalogUnavailable):
            await lookup_product(db, down, "00000017")


async def test_search_is_cached_by_normalized_query():
    client, seen = make_client(lambda r: httpx.Response(200, json=load_fixture("search_alicious_chocolate")))
    q = "Zq cache test"
    async with TestSessionLocal() as db:
        await search_products(db, client, q, 1)
        await search_products(db, client, "  zq   CACHE test ", 1)
    assert len(seen) == 1


async def test_purge_expired_removes_old_rows_only():
    async with TestSessionLocal() as db:
        await cache.store_product(db, "11111113", {"x": 1})
        await cache.store_product(db, "11111114", None)
    await _age("11111114", timedelta(hours=30))
    await _age("11111113", timedelta(days=10))  # expired but within stale retention
    async with TestSessionLocal() as db:
        await cache.purge_expired(db)
        assert await db.get(CatalogProduct, "11111113") is not None
        assert await db.get(CatalogProduct, "11111114") is None
    await _clear("11111113")
