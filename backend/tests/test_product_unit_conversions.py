import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_product(client, headers, name="Sugar", **overrides):
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


async def test_save_unit_conversion_creates_and_lists_it(client, auth_headers):
    product = await _create_product(client, auth_headers)

    save_resp = await client.post(
        f"/products/{product['id']}/unit-conversions",
        json={"unit": "tbsp", "grams_per_unit": 12.5},
        headers=auth_headers,
    )
    assert save_resp.status_code == 201
    body = save_resp.json()
    assert body["unit"] == "tbsp"
    assert body["grams_per_unit"] == 12.5
    assert body["product_id"] == product["id"]

    list_resp = await client.get(f"/products/{product['id']}/unit-conversions", headers=auth_headers)
    assert list_resp.status_code == 200
    units = list_resp.json()
    assert len(units) == 1
    assert units[0]["unit"] == "tbsp"


async def test_save_unit_conversion_upserts_same_unit(client, auth_headers):
    product = await _create_product(client, auth_headers)

    first = await client.post(
        f"/products/{product['id']}/unit-conversions",
        json={"unit": "tbsp", "grams_per_unit": 12.5},
        headers=auth_headers,
    )
    assert first.json()["grams_per_unit"] == 12.5

    second = await client.post(
        f"/products/{product['id']}/unit-conversions",
        json={"unit": "tbsp", "grams_per_unit": 14.0},
        headers=auth_headers,
    )
    assert second.status_code == 201
    assert second.json()["grams_per_unit"] == 14.0
    assert second.json()["id"] == first.json()["id"]

    list_resp = await client.get(f"/products/{product['id']}/unit-conversions", headers=auth_headers)
    assert len(list_resp.json()) == 1


async def test_unit_is_normalized_to_lowercase(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.post(
        f"/products/{product['id']}/unit-conversions",
        json={"unit": "  TBSP  ", "grams_per_unit": 12.5},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["unit"] == "tbsp"


async def test_save_unit_conversion_non_positive_grams_422(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.post(
        f"/products/{product['id']}/unit-conversions",
        json={"unit": "tbsp", "grams_per_unit": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_unit_conversions_ownership_404(client, auth_headers, second_user_headers):
    foreign_product = await _create_product(client, second_user_headers)

    save_resp = await client.post(
        f"/products/{foreign_product['id']}/unit-conversions",
        json={"unit": "tbsp", "grams_per_unit": 12.5},
        headers=auth_headers,
    )
    assert save_resp.status_code == 404

    list_resp = await client.get(f"/products/{foreign_product['id']}/unit-conversions", headers=auth_headers)
    assert list_resp.status_code == 404


async def test_conversions_are_per_product(client, auth_headers):
    sugar = await _create_product(client, auth_headers, name="Sugar")
    oil = await _create_product(client, auth_headers, name="Oil")

    await client.post(
        f"/products/{sugar['id']}/unit-conversions", json={"unit": "tbsp", "grams_per_unit": 12.5}, headers=auth_headers
    )
    await client.post(
        f"/products/{oil['id']}/unit-conversions", json={"unit": "tbsp", "grams_per_unit": 13.6}, headers=auth_headers
    )

    sugar_list = (await client.get(f"/products/{sugar['id']}/unit-conversions", headers=auth_headers)).json()
    oil_list = (await client.get(f"/products/{oil['id']}/unit-conversions", headers=auth_headers)).json()
    assert sugar_list[0]["grams_per_unit"] == 12.5
    assert oil_list[0]["grams_per_unit"] == 13.6
