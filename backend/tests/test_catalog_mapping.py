import copy

import pytest

from app.catalog.mapping import map_hit, map_product
from app.nutrient_catalog import NUTRIENT_SEED
from tests.catalog_helpers import load_fixture

pytestmark = pytest.mark.asyncio(loop_scope="session")

UNITS = {row[0]: row[2] for row in NUTRIENT_SEED}


def draft(fixture: str, **kw):
    return map_product(load_fixture(fixture)["product"], UNITS, **kw)


async def test_nutella_complete_core_values():
    d = draft("product_nutella")
    assert (d.name, d.brand, d.barcode) == ("Nutella", "Nutella", "3017620422003")
    assert (d.calories, d.protein, d.fat, d.carbs) == (539, 6.3, 30.9, 57.5)
    assert (d.fiber, d.sugar, d.salt, d.saturated_fat) == (3.4, 56.3, 0.11, 10.6)
    assert d.completeness == "complete"
    assert d.portions == []  # no serving_quantity on this product
    assert d.suggested_group == "Sweets"  # sweet-spreads beats generic breakfasts
    assert d.off_url == "https://world.openfoodfacts.org/product/3017620422003"
    assert d.image_url.endswith(".jpg")


async def test_extended_nutrients_converted_from_grams_to_own_unit():
    d = draft("product_nutella")
    assert d.nutrients == {"calcium": 108.0}  # 0.108 g -> mg; added-sugars isn't in our catalog
    thai = draft("product_upc_a_12_digit")
    assert thai.nutrients["vitamin-a"] == 115.5  # 0.0001155 g -> µg
    assert thai.nutrients["vitamin-c"] == 0  # a declared 0 is kept, not dropped
    assert "cholesterol" in thai.nutrients and "trans-fat" in thai.nutrients
    for core in ("fat", "proteins", "sodium", "salt", "energy"):
        assert core not in thai.nutrients


async def test_12_digit_upc_is_normalized_and_serving_becomes_default_portion():
    d = draft("product_upc_a_12_digit")
    assert d.barcode == "0737628064502"
    assert [(p.name, p.grams, p.is_default) for p in d.portions] == [("0.333 PACKAGE (52 g)", 52.0, True)]
    assert d.brand == "Simply Asia"  # first of "Simply Asia, Thai Kitchen"
    assert d.notes == "<p>Pack size: 155 g</p>"


async def test_multi_portion_serving_adds_single_portion_default():
    raw = copy.deepcopy(load_fixture("product_upc_a_12_digit")["product"])
    raw.update(serving_size="5 portions (230 g)", serving_quantity=230)
    d = map_product(raw, UNITS)
    assert [(p.name, p.grams, p.is_default) for p in d.portions] == [
        ("1 portion", 46.0, True),
        ("5 portions (230 g)", 230.0, False),
    ]
    raw.update(serving_size="1 portion (46 g)", serving_quantity=46)
    d = map_product(raw, UNITS)
    assert [(p.name, p.grams, p.is_default) for p in d.portions] == [("1 portion (46 g)", 46.0, True)]


async def test_liquid_gets_note_and_no_gram_portion():
    d = draft("product_cola_liquid")
    assert "Nutrition is per 100 ml" in d.notes
    assert d.portions == []  # 330 ml serving isn't grams
    assert d.suggested_group == "Beverages"


async def test_no_nutrition_product():
    d = draft("product_water_no_nutrition")
    assert d.completeness == "no_nutrition"
    assert d.calories is None and d.protein is None and d.fat is None and d.carbs is None
    assert d.nutrients == {"calcium": 119.0, "magnesium": 28.0, "potassium": 2.0}  # minerals survive without macros
    assert "Pack size: 1500 ml" in d.notes


def _raw(**nutriments):
    return {"code": "3017620422003", "product_name": "X", "nutriments": nutriments}


async def test_calorie_fallbacks():
    assert map_product(_raw(**{"energy-kj_100g": 2092}), UNITS).calories == 500
    assert map_product(_raw(**{"energy_100g": 1046, "energy_unit": "kJ"}), UNITS).calories == 250
    assert map_product(_raw(**{"energy_100g": 250, "energy_unit": "kcal"}), UNITS).calories == 250
    # kcal wins over kJ when both are present
    assert map_product(_raw(**{"energy-kcal_100g": 100, "energy-kj_100g": 9999}), UNITS).calories == 100


async def test_salt_falls_back_to_sodium_times_2_5():
    assert map_product(_raw(sodium_100g=0.4), UNITS).salt == 1.0
    assert map_product(_raw(sodium_100g=0.4, salt_100g=0.9), UNITS).salt == 0.9


async def test_missing_is_null_never_zero_and_zero_is_kept():
    d = map_product(_raw(**{"energy-kcal_100g": 0, "proteins_100g": 0}), UNITS)
    assert (d.calories, d.protein) == (0, 0)
    assert d.fat is None and d.carbs is None and d.fiber is None and d.salt is None
    assert d.completeness == "partial"


async def test_per_serving_only_values_are_scaled_to_100g():
    raw = {"code": "3017620422003", "product_name": "X", "serving_quantity": 50, "serving_quantity_unit": "g",
           "nutriments": {"energy-kcal_serving": 100, "proteins_serving": 5, "calcium_serving": 0.05}}
    d = map_product(raw, UNITS)
    assert (d.calories, d.protein) == (200, 10)
    assert d.nutrients["calcium"] == 100.0  # 0.05 g per 50 g -> 0.1 g/100 g -> 100 mg


async def test_per_serving_ignored_without_gram_serving():
    d = map_product(_raw(**{"energy-kcal_serving": 100}), UNITS)
    assert d.calories is None


async def test_prepared_values_ignored():
    d = map_product(_raw(**{"energy-kcal_prepared_100g": 77, "calcium_prepared_100g": 0.1}), UNITS)
    assert d.calories is None and d.nutrients == {}


async def test_junk_values_become_null():
    d = map_product(_raw(**{"energy-kcal_100g": "n/a", "proteins_100g": -3, "fat_100g": "12.5"}), UNITS)
    assert d.calories is None and d.protein is None and d.fat == 12.5


async def test_name_fallbacks_and_default():
    base = {"code": "3017620422003", "nutriments": {}}
    assert map_product({**base, "product_name": "  ", "product_name_en": " Milk "}, UNITS).name == "Milk"
    assert map_product({**base, "generic_name": "Generic"}, UNITS).name == "Generic"
    assert map_product(base, UNITS).name == "Product 3017620422003"


async def test_group_id_resolved_from_supplied_map():
    import uuid

    gid = uuid.uuid4()
    assert draft("product_nutella", group_ids={"Sweets": gid}).suggested_group_id == gid
    assert draft("product_nutella").suggested_group_id is None


async def test_input_not_mutated():
    raw = load_fixture("product_nutella")["product"]
    before = copy.deepcopy(raw)
    map_product(raw, UNITS)
    assert raw == before


async def test_search_hits_map_and_normalize_codes():
    hits = [map_hit(h) for h in load_fixture("search_alicious_chocolate")["hits"]]
    assert all(h is not None for h in hits)
    first = hits[0]
    assert first.code == "0009800800049" and first.brand == "Nutella" and first.name
    legacy = [map_hit(h) for h in load_fixture("search_legacy_nutella")["products"]]
    assert all(h and h.code.isdigit() for h in legacy)
    assert map_hit({"code": "", "product_name": "x"}) is None
