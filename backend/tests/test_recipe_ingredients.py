import pytest

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


async def _create_recipe(client, headers, name="Test Recipe", ingredients=None):
    resp = await client.post("/recipes", json={"name": name, "ingredients": ingredients or []}, headers=headers)
    return resp.json()


async def test_relink_ingredient_resyncs_snapshot_from_new_product(client, auth_headers):
    old_product = await _create_product(client, auth_headers, name="Old Butter", calories=717)
    new_product = await _create_product(client, auth_headers, name="89% Butter", brand="Dairy Co", calories=800)
    recipe = await _create_recipe(
        client, auth_headers, ingredients=[{"product_id": old_product["id"], "grams": 20}]
    )
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"product_id": new_product["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["product_id"] == new_product["id"]
    assert body["is_linked"] is True
    assert body["name"] == "89% Butter"
    assert body["brand"] == "Dairy Co"
    assert body["calories"] == 800
    assert body["grams"] == 20  # untouched, not sent in the request


async def test_relink_ignores_manual_fields_sent_alongside_product_id(client, auth_headers):
    product = await _create_product(client, auth_headers, name="Real Product", calories=500)
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"name": "Placeholder", "grams": 30, "calories": 1}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"product_id": product["id"], "name": "Ignored Name", "calories": 9999},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Real Product"
    assert body["calories"] == 500


async def test_unlink_preserves_snapshot(client, auth_headers):
    product = await _create_product(client, auth_headers, name="Cottage Cheese A", calories=98)
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"product_id": product["id"], "grams": 150}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"product_id": None},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["product_id"] is None
    assert body["is_linked"] is False
    assert body["name"] == "Cottage Cheese A"
    assert body["calories"] == 98
    assert body["grams"] == 150


async def test_manual_edit_without_product_id_key_leaves_link_untouched(client, auth_headers):
    product = await _create_product(client, auth_headers, name="Linked Product", calories=200)
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"product_id": product["id"], "grams": 100}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"calories": 250},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["product_id"] == product["id"]
    assert body["is_linked"] is True
    assert body["calories"] == 250
    assert body["name"] == "Linked Product"  # unaffected


async def test_edit_grams_zero_or_negative_422(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"name": "Whatever", "grams": 10}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"grams": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_ingredient_ownership_404(client, auth_headers, second_user_headers):
    recipe = await _create_recipe(client, second_user_headers, ingredients=[{"name": "Not Yours", "grams": 10}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"calories": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_relink_to_invalid_product_400(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"name": "Whatever", "grams": 10}])
    ingredient_id = recipe["ingredients"][0]["id"]

    resp = await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"product_id": "00000000-0000-0000-0000-000000000000"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_edit_reflected_in_recipe_nutrition_on_next_read(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers, ingredients=[{"name": "Adjustable", "grams": 100, "calories": 50}])
    ingredient_id = recipe["ingredients"][0]["id"]
    assert recipe["nutrition"]["per_meal"]["calories"] == 50

    await client.patch(
        f"/recipes/{recipe['id']}/ingredients/{ingredient_id}",
        json={"calories": 150},
        headers=auth_headers,
    )

    fetched = await client.get(f"/recipes/{recipe['id']}", headers=auth_headers)
    assert fetched.json()["nutrition"]["per_meal"]["calories"] == 150
