"""Pure OFF -> NutriScan mapping. No I/O: callers pass in the nutrient units
(from the `nutrients` table) and, optionally, system group ids by name.

Unit evidence (recorded fixtures, e.g. product_upc_a_12_digit.json): every
`<code>_100g` value is in GRAMS regardless of the nutrient's usual unit
(vitamin-a_100g = 0.0001155 with vitamin-a_unit = "g" -> 115.5 µg), so extended
nutrients are converted from grams into each nutrient's own unit.
"""
import re
import uuid
from html import escape

from app.catalog.barcodes import normalize_barcode
from app.catalog.groups import suggest_group
from app.schemas.catalog import CatalogHit, CatalogProductDraft, DraftPortion

OFF_PRODUCT_URL = "https://world.openfoodfacts.org/product/"
KJ_PER_KCAL = 4.184
SALT_PER_SODIUM = 2.5
FROM_GRAMS = {"g": 1.0, "mg": 1e3, "µg": 1e6, "ug": 1e6}
# OFF keys handled explicitly above; never treated as extended nutrients.
CORE_KEYS = {"energy", "energy-kcal", "energy-kj", "proteins", "fat", "carbohydrates", "fiber", "sugars", "salt",
             "sodium", "saturated-fat"}
_LIQUID_QUANTITY = re.compile(r"\d\s*(ml|cl|dl|l)\b", re.IGNORECASE)
_SERVING_COUNT = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:portions?|servings?|pieces?|pcs|slices?)\b", re.IGNORECASE)


def _num(value) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number >= 0 else None  # drops NaN and negatives


def _round_g(x: float) -> float:
    return round(x, 2) if x < 10 else round(x, 1)


def _serving_grams(raw: dict) -> float | None:
    grams = _num(raw.get("serving_quantity"))
    unit = (raw.get("serving_quantity_unit") or "g").lower()
    return grams if grams and grams > 0 and unit == "g" else None


def _per_100(n: dict, key: str, serving_g: float | None) -> float | None:
    """`<key>_100g`, else derived from `<key>_serving` when the serving is in grams."""
    value = _num(n.get(f"{key}_100g"))
    if value is not None:
        return value
    per_serving = _num(n.get(f"{key}_serving"))
    if per_serving is not None and serving_g:
        return per_serving / serving_g * 100
    return None


def _calories(n: dict, serving_g: float | None) -> float | None:
    kcal = _per_100(n, "energy-kcal", serving_g)
    if kcal is None:
        kj = _per_100(n, "energy-kj", serving_g)
        if kj is None and (n.get("energy_unit") or "kJ").lower() == "kj":
            kj = _per_100(n, "energy", serving_g)
        elif kj is None and (n.get("energy_unit") or "").lower() == "kcal":
            kcal = _per_100(n, "energy", serving_g)
        if kcal is None and kj is not None:
            kcal = kj / KJ_PER_KCAL
    return None if kcal is None else float(round(kcal))


def _serving_count(label: str) -> float | None:
    """N from a serving label like "5 portions (230 g)"; None unless N > 1."""
    match = _SERVING_COUNT.match(label)
    count = float(match.group(1).replace(",", ".")) if match else 0
    return count if count > 1 else None


def is_liquid(raw: dict) -> bool:
    unit = (raw.get("serving_quantity_unit") or "").lower()
    return unit == "ml" or bool(_LIQUID_QUANTITY.search(raw.get("quantity") or ""))


def _name(raw: dict, code: str) -> str:
    for key in ("product_name", "product_name_en", "generic_name"):
        value = (raw.get(key) or "").strip()
        if value:
            return value[:200]
    return f"Product {code}"


def _first_brand(brands) -> str | None:
    if isinstance(brands, list):  # Search-a-licious returns a list
        brands = brands[0] if brands else None
    first = (brands or "").split(",")[0].strip()
    return first or None


def _notes(raw: dict) -> str | None:
    lines = []
    quantity = (raw.get("quantity") or "").strip()
    if quantity:
        lines.append(f"Pack size: {quantity}")
    if is_liquid(raw):
        lines.append("Nutrition is per 100 ml")
    return "".join(f"<p>{escape(line)}</p>" for line in lines) or None


def map_product(
    raw: dict,
    nutrient_units: dict[str, str],
    group_ids: dict[str, uuid.UUID] | None = None,
    code: str | None = None,
) -> CatalogProductDraft:
    code = normalize_barcode(code or raw.get("code")) or ""
    n = raw.get("nutriments") or {}
    serving_g = _serving_grams(raw)

    def grams(key: str) -> float | None:
        value = _per_100(n, key, serving_g)
        return None if value is None else _round_g(value)

    salt = grams("salt")
    if salt is None:
        sodium = _per_100(n, "sodium", serving_g)
        salt = None if sodium is None else _round_g(sodium * SALT_PER_SODIUM)

    extended: dict[str, float] = {}
    for key in n:
        if not key.endswith("_100g"):
            continue
        nutrient = key[: -len("_100g")]
        unit = nutrient_units.get(nutrient)
        if nutrient in CORE_KEYS or unit is None or "_prepared" in key:
            continue
        value = _num(n[key])
        if value is not None:
            extended[nutrient] = round(value * FROM_GRAMS.get(unit, 1.0), 3)
    # Per-serving-only extended nutrients.
    if serving_g:
        for key in n:
            if not key.endswith("_serving"):
                continue
            nutrient = key[: -len("_serving")]
            unit = nutrient_units.get(nutrient)
            value = _num(n[key])
            if nutrient in CORE_KEYS or unit is None or nutrient in extended or value is None:
                continue
            extended[nutrient] = round(value / serving_g * 100 * FROM_GRAMS.get(unit, 1.0), 3)

    calories, protein, fat, carbs = _calories(n, serving_g), grams("proteins"), grams("fat"), grams("carbohydrates")
    core = (calories, protein, fat, carbs)
    if all(v is None for v in core) or raw.get("no_nutrition_data") == "on":
        completeness = "no_nutrition"
    elif any(v is None for v in core):
        completeness = "partial"
    else:
        completeness = "complete"

    portions = []
    if serving_g:
        label = (raw.get("serving_size") or "").strip()
        count = _serving_count(label)
        if count:  # label covers N portions: default to one, keep the whole pack too
            portions.append(DraftPortion(name="1 portion", grams=round(serving_g / count, 2), is_default=True))
        portions.append(DraftPortion(name=(label or "1 serving")[:100], grams=round(serving_g, 2), is_default=not count))

    group = suggest_group(raw.get("categories_tags"))
    return CatalogProductDraft(
        name=_name(raw, code),
        brand=_first_brand(raw.get("brands")),
        barcode=code,
        calories=calories,
        protein=protein,
        fat=fat,
        carbs=carbs,
        fiber=grams("fiber"),
        sugar=grams("sugars"),
        salt=salt,
        saturated_fat=grams("saturated-fat"),
        nutrients=extended,
        notes=_notes(raw),
        portions=portions,
        suggested_group=group,
        suggested_group_id=(group_ids or {}).get(group) if group else None,
        completeness=completeness,
        image_url=raw.get("image_front_small_url") or None,
        off_url=f"{OFF_PRODUCT_URL}{code}",
    )


def map_hit(raw: dict) -> CatalogHit | None:
    """Search result row; None when it can't be opened (no usable code)."""
    code = normalize_barcode(str(raw.get("code") or ""))
    if not code or not code.isdigit():
        return None
    n = raw.get("nutriments") or {}
    return CatalogHit(
        code=code,
        name=_name(raw, code),
        brand=_first_brand(raw.get("brands")),
        quantity=(raw.get("quantity") or "").strip() or None,
        image_url=raw.get("image_front_small_url") or None,
        kcal_100g=_calories(n, None),
    )
