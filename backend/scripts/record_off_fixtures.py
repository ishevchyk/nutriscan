"""One-off: record real OFF staging responses as test fixtures.

    .venv/bin/python scripts/record_off_fixtures.py

Spaced 6 s apart to stay far below OFF's per-IP limits.
"""
import base64
import json
import time
import urllib.request
from pathlib import Path

from app.catalog.off_client import API_VERSION, PRODUCT_FIELDS

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "off"
BASE = "https://world.openfoodfacts.net"
UA = "NutriScan/0.1.0 (fixture-recorder)"
AUTH = "Basic " + base64.b64encode(b"off:off").decode()

PRODUCTS = {
    "nutella": "3017620422003",
    "smoke_skyr": "9999999999994",
    "cola_liquid": "5449000000996",
    "upc_a_12_digit": "737628064502",
    "water_no_nutrition": "3274080005003",
    "not_found": "0000000000017",
}


def get(url: str, auth: bool = False) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **({"Authorization": AUTH} if auth else {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"_http_status": e.code, "body": e.read().decode()[:500]}


def save(name: str, data: dict) -> None:
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
    print("saved", name)


OUT.mkdir(parents=True, exist_ok=True)
for name, code in PRODUCTS.items():
    save(f"product_{name}", get(f"{BASE}/api/v{API_VERSION}/product/{code}?fields={PRODUCT_FIELDS}", auth=True))
    time.sleep(6)
save(
    "search_alicious_chocolate",
    get("https://search.openfoodfacts.org/search?q=nutella&langs=en&page_size=5&page=1"
        "&fields=code,product_name,brands,quantity,image_front_small_url,nutriments"),
)
time.sleep(6)
save("search_legacy_nutella", get(f"{BASE}/cgi/search.pl?search_terms=nutella&search_simple=1&json=1&page_size=5"
     f"&fields={PRODUCT_FIELDS}", auth=True))
