"""Async Open Food Facts client. Owns the whole shared per-IP budget: every
NutriScan user goes through this one process, so it enforces its own token
buckets and a circuit breaker and fails fast rather than queueing."""
import httpx

from app.catalog.errors import CatalogUnavailable
from app.catalog.rate_limit import CircuitBreaker, TokenBucket
from app.config import settings

# Pinned: v3.5+ returns OFF's still-evolving nutrition-facts structure. v3.4
# keeps the classic flat `nutriments` object (OFF downgrades to the requested
# version). Migrating later is a change to this one constant (+ mapping.py).
API_VERSION = "3.4"

PRODUCT_FIELDS = ",".join(
    [
        "code", "product_name", "product_name_en", "product_name_uk", "generic_name", "brands", "quantity",
        "nutriments", "nutrition_data_per", "serving_size", "serving_quantity", "serving_quantity_unit",
        "categories_tags", "image_front_small_url", "lang", "no_nutrition_data",
    ]
)
SEARCH_FIELDS = "code,product_name,product_name_en,generic_name,brands,quantity,image_front_small_url,nutriments"

PRODUCTION_URL = "https://world.openfoodfacts.org"
STAGING_URL = "https://world.openfoodfacts.net"
TIMEOUT_SECONDS = 5.0
PRODUCT_READS_PER_MINUTE = 12  # OFF allows 15/min per IP
SEARCHES_PER_MINUTE = 8  # OFF allows 10/min per IP
BREAKER_COOLDOWN_SECONDS = 60


class OffClient:
    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None, cfg=settings):
        self.cfg = cfg
        self.base_url = (cfg.off_base_url or (STAGING_URL if cfg.off_use_staging else PRODUCTION_URL)).rstrip("/")
        self.search_url = cfg.off_search_url.rstrip("/")
        self.product_bucket = TokenBucket(PRODUCT_READS_PER_MINUTE)
        self.search_bucket = TokenBucket(SEARCHES_PER_MINUTE)
        self.breaker = CircuitBreaker(BREAKER_COOLDOWN_SECONDS)
        auth = None
        if cfg.off_use_staging and cfg.off_staging_auth and ":" in cfg.off_staging_auth:
            user, _, pw = cfg.off_staging_auth.partition(":")
            auth = httpx.BasicAuth(user, pw)
        self._http = httpx.AsyncClient(
            transport=transport,
            timeout=TIMEOUT_SECONDS,
            headers={"User-Agent": f"NutriScan/{cfg.app_version} ({cfg.off_contact_email})"},
            auth=auth,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    def _guard(self) -> None:
        if not self.cfg.off_enabled:
            raise CatalogUnavailable(retry_after=3600)
        remaining = self.breaker.remaining()
        if remaining:
            raise CatalogUnavailable(retry_after=remaining)

    async def _get(self, url: str, params: dict, *, auth: bool = True) -> httpx.Response:
        try:
            resp = await self._http.get(url, params=params, **({} if auth else {"auth": None}))
        except httpx.HTTPError:
            self.breaker.trip()
            raise CatalogUnavailable(retry_after=BREAKER_COOLDOWN_SECONDS)
        if resp.status_code == 429 or resp.status_code >= 500:
            self.breaker.trip()
            raise CatalogUnavailable(retry_after=BREAKER_COOLDOWN_SECONDS)
        return resp

    async def fetch_product(self, code: str) -> dict | None:
        """Raw OFF product dict, or None when OFF doesn't know the barcode."""
        self._guard()
        self.product_bucket.try_acquire()
        resp = await self._get(
            f"{self.base_url}/api/v{API_VERSION}/product/{code}", {"fields": PRODUCT_FIELDS}
        )
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            raise CatalogUnavailable(retry_after=BREAKER_COOLDOWN_SECONDS)
        body = resp.json()
        product = body.get("product")
        if body.get("status") == "failure" or not product:
            return None
        return product

    async def search(self, q: str, page: int, *, langs: str = "en", page_size: int = 20) -> dict:
        """Returns {"hits": [raw product dicts], "page": int, "has_more": bool}."""
        self._guard()
        self.search_bucket.try_acquire()
        if self.cfg.off_search_backend == "legacy":
            return await self._search_legacy(q, page, page_size)
        resp = await self._get(
            f"{self.search_url}/search",
            {"q": q, "langs": langs, "page": page, "page_size": page_size, "fields": SEARCH_FIELDS},
            auth=False,
        )
        if resp.status_code != 200:
            raise CatalogUnavailable(retry_after=BREAKER_COOLDOWN_SECONDS)
        body = resp.json()
        return {"hits": body.get("hits", []), "page": body.get("page", page), "has_more": page < body.get("page_count", 0)}

    async def _search_legacy(self, q: str, page: int, page_size: int) -> dict:
        resp = await self._get(
            f"{self.base_url}/cgi/search.pl",
            {"search_terms": q, "search_simple": 1, "json": 1, "page": page, "page_size": page_size,
             "fields": SEARCH_FIELDS},
        )
        if resp.status_code != 200:
            raise CatalogUnavailable(retry_after=BREAKER_COOLDOWN_SECONDS)
        body = resp.json()
        return {"hits": body.get("products", []), "page": body.get("page", page), "has_more": page < body.get("page_count", 0)}


_client: OffClient | None = None


def get_off_client() -> OffClient:
    """FastAPI dependency; tests override it with a MockTransport-backed client."""
    global _client
    if _client is None:
        _client = OffClient()
    return _client


async def close_off_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
