import pytest

from app.models.product_unit_conversions import ProductUnitConversion
from tests.conftest import TestSessionLocal

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_product(client, headers, name="Test Product", **overrides):
    body = {
        "name": name,
        "calories": 100,
        "protein": 5,
        "fat": 2,
        "carbs": 10,
        "fiber": 1,
        "sugar": 3,
        "salt": 0.1,
    }
    body.update(overrides)
    resp = await client.post("/products", json=body, headers=headers)
    return resp.json()


async def _create_recipe(client, headers, name="Test Recipe"):
    resp = await client.post("/recipes", json={"name": name, "ingredients": []}, headers=headers)
    return resp.json()


async def _save_conversion(product_id: str, unit: str, grams_per_unit: float) -> None:
    async with TestSessionLocal() as db:
        db.add(ProductUnitConversion(product_id=product_id, unit=unit, grams_per_unit=grams_per_unit))
        await db.commit()


async def test_add_ingredient_gram_unit_uses_input_amount_directly(client, auth_headers):
    product = await _create_product(client, auth_headers)
    recipe = await _create_recipe(client, auth_headers)

    resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"product_id": product["id"], "input_amount": 150, "input_unit": "g"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["input_amount"] == 150
    assert body["input_unit"] == "g"
    assert body["grams"] == 150


async def test_add_ingredient_household_unit_uses_saved_conversion(client, auth_headers):
    sugar = await _create_product(client, auth_headers, name="Sugar")
    await _save_conversion(sugar["id"], "tbsp", 12.5)
    recipe = await _create_recipe(client, auth_headers)

    resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"product_id": sugar["id"], "input_amount": 3, "input_unit": "tbsp"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["input_amount"] == 3
    assert body["input_unit"] == "tbsp"
    assert body["grams"] == pytest.approx(37.5)  # 3 tbsp x 12.5 g/tbsp


async def test_conversion_is_per_product_not_global(client, auth_headers):
    """A tbsp of sugar and a tbsp of oil weigh different amounts -- the lookup
    must be keyed by (product_id, unit), never unit alone."""
    sugar = await _create_product(client, auth_headers, name="Sugar")
    oil = await _create_product(client, auth_headers, name="Oil")
    await _save_conversion(sugar["id"], "tbsp", 12.5)
    await _save_conversion(oil["id"], "tbsp", 13.6)
    recipe = await _create_recipe(client, auth_headers)

    sugar_resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"product_id": sugar["id"], "input_amount": 3, "input_unit": "tbsp"},
        headers=auth_headers,
    )
    oil_resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"product_id": oil["id"], "input_amount": 3, "input_unit": "tbsp"},
        headers=auth_headers,
    )
    assert sugar_resp.json()["grams"] == pytest.approx(37.5)
    assert oil_resp.json()["grams"] == pytest.approx(40.8)


async def test_add_ingredient_household_unit_missing_conversion_422(client, auth_headers):
    product = await _create_product(client, auth_headers)
    recipe = await _create_recipe(client, auth_headers)

    resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"product_id": product["id"], "input_amount": 2, "input_unit": "cup"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error_code"] == "unit_conversion_missing"


async def test_add_unlinked_ingredient_household_unit_requires_grams(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)

    missing_grams = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"name": "Homemade jam", "calories": 250, "input_amount": 2, "input_unit": "tbsp"},
        headers=auth_headers,
    )
    assert missing_grams.status_code == 422
    assert missing_grams.json()["detail"]["error_code"] == "grams_required"

    with_grams = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"name": "Homemade jam", "calories": 250, "input_amount": 2, "input_unit": "tbsp", "grams": 30},
        headers=auth_headers,
    )
    assert with_grams.status_code == 201
    body = with_grams.json()
    assert body["input_amount"] == 2
    assert body["input_unit"] == "tbsp"
    assert body["grams"] == 30


async def test_patch_input_amount_recomputes_grams(client, auth_headers):
    sugar = await _create_product(client, auth_headers, name="Sugar")
    await _save_conversion(sugar["id"], "tbsp", 12.5)
    recipe = await _create_recipe(client, auth_headers)
    ingredient = (
        await client.post(
            f"/recipes/{recipe['id']}/ingredients",
            json={"product_id": sugar["id"], "input_amount": 1, "input_unit": "tbsp"},
            headers=auth_headers,
        )
    ).json()
    assert ingredient["grams"] == pytest.approx(12.5)

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient['id']}",
        json={"input_amount": 4},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["input_amount"] == 4
    assert body["input_unit"] == "tbsp"
    assert body["grams"] == pytest.approx(50)


async def test_patch_input_unit_without_saved_conversion_422(client, auth_headers):
    sugar = await _create_product(client, auth_headers, name="Sugar")
    recipe = await _create_recipe(client, auth_headers)
    ingredient = (
        await client.post(
            f"/recipes/{recipe['id']}/ingredients",
            json={"product_id": sugar["id"], "input_amount": 100, "input_unit": "g"},
            headers=auth_headers,
        )
    ).json()

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient['id']}",
        json={"input_unit": "cup"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error_code"] == "unit_conversion_missing"


async def test_direct_grams_patch_without_input_fields_still_a_manual_override(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    ingredient = (
        await client.post(
            f"/recipes/{recipe['id']}/ingredients",
            json={"name": "Manual thing", "calories": 10, "input_amount": 100, "input_unit": "g"},
            headers=auth_headers,
        )
    ).json()

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient['id']}",
        json={"grams": 42},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["grams"] == 42
    assert body["input_amount"] == 100  # untouched -- input_amount/input_unit weren't in this patch
    assert body["input_unit"] == "g"


async def test_add_ingredient_recipe_ownership_404(client, auth_headers, second_user_headers):
    recipe = await _create_recipe(client, second_user_headers)
    resp = await client.post(
        f"/recipes/{recipe['id']}/ingredients",
        json={"name": "Not yours", "calories": 1, "input_amount": 10, "input_unit": "g"},
        headers=auth_headers,
    )
    assert resp.status_code == 404
