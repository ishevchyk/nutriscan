import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, func, select

from app.catalog.off_client import get_off_client
from app.main import app
from app.models.catalog import CatalogProduct, CatalogSearchCache
from app.models.product import Product
from app.routers import catalog as catalog_router
from tests.catalog_helpers import load_fixture, make_client
from tests.conftest import TestSessionLocal

pytestmark = pytest.mark.asyncio(loop_scope="session")

NUTELLA = "3017620422003"


def _router(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path.endswith(f"/product/{NUTELLA}"):
        return httpx.Response(200, json=load_fixture("product_nutella"))
    if path.endswith("/product/0737628064502"):
        return httpx.Response(200, json=load_fixture("product_upc_a_12_digit"))
    if "/product/" in path:
        return httpx.Response(404, json=load_fixture("product_not_found"))
    return httpx.Response(200, json=load_fixture("search_alicious_chocolate"))


@pytest_asyncio.fixture(loop_scope="session", autouse=True)
async def off(request):
    async with TestSessionLocal() as db:
        await db.execute(delete(CatalogProduct))
        await db.execute(delete(CatalogSearchCache))
        await db.commit()
    catalog_router.user_limiter.hits.clear()
    handler = getattr(request, "param", None) or _router
    client, seen = make_client(handler)
    app.dependency_overrides[get_off_client] = lambda: client
    yield seen
    app.dependency_overrides.pop(get_off_client, None)


def _with_handler(handler):
    return pytest.mark.parametrize("off", [handler], indirect=True)


async def test_all_endpoints_require_auth(client):
    assert (await client.get(f"/catalog/barcode/{NUTELLA}")).status_code in (401, 403)
    assert (await client.get("/catalog/search?q=nutella")).status_code in (401, 403)
    assert (await client.post("/catalog/import", json={"name": "x", "barcode": NUTELLA})).status_code in (401, 403)


async def test_barcode_returns_draft(client, auth_headers):
    resp = await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Nutella" and body["calories"] == 539 and body["completeness"] == "complete"
    assert body["already_in_library"] is None
    assert body["suggested_group"] == "Sweets" and body["suggested_group_id"] is not None


async def test_barcode_normalizes_input_and_hits_cache(client, auth_headers, off):
    first = await client.get("/catalog/barcode/737628064502", headers=auth_headers)  # 12-digit UPC-A
    assert first.status_code == 200 and first.json()["barcode"] == "0737628064502"
    second = await client.get("/catalog/barcode/0737628064502", headers=auth_headers)
    assert second.status_code == 200
    assert len(off) == 1  # second call served from the Postgres cache
    assert first.json()["portions"] == [{"name": "0.333 PACKAGE (52 g)", "grams": 52.0, "is_default": True}]


async def test_unknown_barcode_is_404_with_code_and_negative_cached(client, auth_headers, off):
    for _ in range(2):
        resp = await client.get("/catalog/barcode/0000000000017", headers=auth_headers)
        assert resp.status_code == 404 and resp.json()["detail"] == {"code": "catalog_not_found"}
    assert len(off) == 1


@pytest.mark.parametrize("bad", ["abc", "123456789012345", "12ab34"])
async def test_invalid_barcode_is_422(client, auth_headers, bad):
    resp = await client.get(f"/catalog/barcode/{bad}", headers=auth_headers)
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "invalid_barcode"


@_with_handler(lambda r: httpx.Response(503))
async def test_off_down_maps_to_503_with_retry_after(client, auth_headers):
    resp = await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)
    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] == "catalog_unavailable"
    assert resp.json()["detail"]["retry_after"] >= 1
    assert int(resp.headers["retry-after"]) >= 1


async def test_local_budget_exhausted_maps_to_503(client, auth_headers, off):
    # 12 distinct lookups drain the product bucket; the 13th fails fast.
    codes = [f"30176204220{n:02d}" for n in range(13)]
    statuses = []
    for code in codes:
        catalog_router.user_limiter.hits.clear()
        statuses.append((await client.get(f"/catalog/barcode/{code}", headers=auth_headers)).status_code)
    assert statuses[-1] == 503 and len(off) == 12


async def test_disabled_catalog_is_503(client, auth_headers):
    disabled, _ = make_client(_router, off_enabled=False)
    app.dependency_overrides[get_off_client] = lambda: disabled
    resp = await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)
    assert resp.status_code == 503 and resp.json()["detail"]["code"] == "catalog_unavailable"


async def test_per_user_limit_returns_429(client, auth_headers, second_user_headers):
    for _ in range(20):
        assert (await client.get("/catalog/search?q=nutella", headers=auth_headers)).status_code == 200
    limited = await client.get("/catalog/search?q=nutella", headers=auth_headers)
    assert limited.status_code == 429 and limited.json()["detail"]["code"] == "rate_limited"
    assert (await client.get("/catalog/search?q=nutella", headers=second_user_headers)).status_code == 200


async def test_search_returns_hits(client, auth_headers):
    resp = await client.get("/catalog/search?q=nutella&page=1", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1 and body["has_more"] is True and body["items"]
    item = body["items"][0]
    assert item["code"] == "0009800800049" and item["brand"] == "Nutella" and item["kcal_100g"] is not None


@pytest.mark.parametrize("q", ["", "ab", "  a  "])
async def test_search_query_too_short(client, auth_headers, q):
    resp = await client.get("/catalog/search", params={"q": q}, headers=auth_headers)
    assert resp.status_code == 422 and resp.json()["detail"]["code"] == "invalid_query"


def _import_body(**overrides):
    return {
        "name": "Nutella", "brand": "Nutella", "barcode": NUTELLA, "calories": 539, "protein": 6.3, "fat": 30.9,
        "carbs": 57.5, "nutrients": {"calcium": 108.0}, "portions": [{"name": "1 tbsp", "grams": 15, "is_default": True}],
        **overrides,
    }


async def _sweets_id(client, auth_headers):
    draft = (await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)).json()
    return draft["suggested_group_id"]


async def test_import_creates_product_portions_nutrients_and_group_in_one_go(client, auth_headers):
    group_id = await _sweets_id(client, auth_headers)
    resp = await client.post("/catalog/import", json=_import_body(group_ids=[group_id]), headers=auth_headers)
    assert resp.status_code == 201
    product = resp.json()
    assert product["source"] == "catalog" and product["barcode"] == NUTELLA
    assert [(p["name"], p["grams"], p["is_default"]) for p in product["portions"]] == [("1 tbsp", 15.0, True)]
    assert product["nutrients"] == {"calcium": 108.0}
    assert [g["id"] for g in product["groups"]] == [group_id]
    fetched = await client.get(f"/products/{product['id']}", headers=auth_headers)
    assert fetched.status_code == 200 and fetched.json()["portions"]


async def test_import_ignores_client_supplied_source_and_normalizes_barcode(client, auth_headers):
    resp = await client.post(
        "/catalog/import", json=_import_body(barcode="737628064502", source="manual", portions=[]), headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["source"] == "catalog" and resp.json()["barcode"] == "0737628064502"


async def test_import_only_one_default_portion(client, auth_headers):
    portions = [{"name": "a", "grams": 10, "is_default": True}, {"name": "b", "grams": 20, "is_default": True}]
    resp = await client.post("/catalog/import", json=_import_body(portions=portions), headers=auth_headers)
    assert resp.status_code == 201
    assert sorted(p["is_default"] for p in resp.json()["portions"]) == [False, True]


async def test_import_duplicate_is_409(client, auth_headers):
    first = await client.post("/catalog/import", json=_import_body(), headers=auth_headers)
    again = await client.post("/catalog/import", json=_import_body(), headers=auth_headers)
    assert again.status_code == 409
    assert again.json()["detail"] == {"code": "already_in_library", "product_id": first.json()["id"]}
    # a 12-digit spelling of a stored 13-digit code is the same product
    upc = await client.post("/catalog/import", json=_import_body(barcode="034000470693"), headers=auth_headers)
    assert upc.status_code == 201
    dup = await client.post("/catalog/import", json=_import_body(barcode="0034000470693"), headers=auth_headers)
    assert dup.status_code == 409


async def test_barcode_reports_library_state_including_soft_deleted(client, auth_headers, second_user_headers):
    created = (await client.post("/catalog/import", json=_import_body(), headers=auth_headers)).json()
    state = (await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)).json()["already_in_library"]
    assert state == {"product_id": created["id"], "deleted": False}

    assert (await client.delete(f"/products/{created['id']}", headers=auth_headers)).status_code == 204
    state = (await client.get(f"/catalog/barcode/{NUTELLA}", headers=auth_headers)).json()["already_in_library"]
    assert state == {"product_id": created["id"], "deleted": True}
    # soft-deleted doesn't block a fresh import
    again = await client.post("/catalog/import", json=_import_body(), headers=auth_headers)
    assert again.status_code == 201

    # another user's library is invisible
    other = (await client.get(f"/catalog/barcode/{NUTELLA}", headers=second_user_headers)).json()
    assert other["already_in_library"] is None


async def test_import_rolls_back_everything_on_bad_nutrient(client, auth_headers):
    resp = await client.post(
        "/catalog/import", json=_import_body(barcode="9780201379624", nutrients={"not-a-nutrient": 1}), headers=auth_headers
    )
    assert resp.status_code == 422
    async with TestSessionLocal() as db:
        count = (await db.execute(select(func.count()).select_from(Product).where(Product.barcode == "9780201379624"))).scalar()
    assert count == 0


async def test_import_rolls_back_on_invalid_group(client, auth_headers):
    resp = await client.post(
        "/catalog/import",
        json=_import_body(barcode="9780306406157", group_ids=["00000000-0000-0000-0000-000000000000"]),
        headers=auth_headers,
    )
    assert resp.status_code == 400 and resp.json()["detail"]["code"] == "invalid_group_ids"
    async with TestSessionLocal() as db:
        count = (await db.execute(select(func.count()).select_from(Product).where(Product.barcode == "9780306406157"))).scalar()
    assert count == 0


async def test_import_rejects_invalid_barcode(client, auth_headers):
    resp = await client.post("/catalog/import", json=_import_body(barcode="12ab"), headers=auth_headers)
    assert resp.status_code == 422


async def test_products_api_normalizes_barcode_on_write(client, auth_headers):
    created = await client.post("/products", json={"name": "UPC", "barcode": "034000470693"}, headers=auth_headers)
    assert created.json()["barcode"] == "0034000470693"
    patched = await client.patch(f"/products/{created.json()['id']}", json={"barcode": "96385074"}, headers=auth_headers)
    assert patched.json()["barcode"] == "96385074"
