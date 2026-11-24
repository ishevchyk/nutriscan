import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _product(client, headers, name="Oil", **overrides):
    body = {"name": name, "calories": 800, "protein": 0, "fat": 90, "carbs": 0, "fiber": 0}
    body.update(overrides)
    return (await client.post("/products", json=body, headers=headers)).json()


async def _mayo(client, headers, **overrides):
    oil = await _product(client, headers, "Oil")
    egg = await _product(client, headers, "Egg", calories=150, protein=12, fat=10, carbs=1, fiber=None)
    body = {
        "name": "Mayo",
        "description": "homemade",
        "ingredients": [
            {"product_id": oil["id"], "input_amount": 100},
            {"product_id": egg["id"], "input_amount": 100},
        ],
    }
    body.update(overrides)
    resp = await client.post("/meals", json=body, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def test_convert_creates_product_from_meal(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    await client.post(f"/meals/{meal['id']}/portions", json={"name": "Tbsp", "grams": 20, "is_default": True}, headers=auth_headers)

    resp = await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)
    assert resp.status_code == 201
    product = resp.json()
    assert product["name"] == "Mayo"
    assert product["brand"] == "From custom meal"
    assert product["source"] == "custom_meal"
    assert product["source_meal_id"] == meal["id"]
    assert product["notes"] == "homemade"
    assert product["calories"] == pytest.approx(475)  # (800 + 150) / 200 g * 100
    assert product["fat"] == pytest.approx(50)
    assert product["fiber"] == pytest.approx(0)  # oil knows fiber
    assert [(p["name"], p["grams"], p["is_default"]) for p in product["portions"]] == [("Tbsp", 20, True)]

    detail = (await client.get(f"/meals/{meal['id']}", headers=auth_headers)).json()
    assert detail["linked_product_id"] == product["id"]


async def test_convert_unknown_optional_stays_null(client, auth_headers):
    egg = await _product(client, auth_headers, "Egg", fiber=None, sugar=None, salt=None, saturated_fat=None)
    meal = (await client.post("/meals", json={"name": "Eggs", "ingredients": [{"product_id": egg["id"], "input_amount": 50}]}, headers=auth_headers)).json()
    product = (await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)).json()
    assert product["fiber"] is None and product["sugar"] is None


async def test_convert_twice_conflicts(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    first = (await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)).json()
    resp = await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["detail"] == {"code": "already_converted", "product_id": first["id"]}


async def test_convert_empty_meal_rejected(client, auth_headers):
    meal = (await client.post("/meals", json={"name": "Empty", "ingredients": []}, headers=auth_headers)).json()
    resp = await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "meal_has_no_ingredients"


async def test_convert_other_users_meal_404(client, auth_headers, second_user_headers):
    meal = await _mayo(client, auth_headers)
    resp = await client.post(f"/meals/{meal['id']}/convert-to-product", headers=second_user_headers)
    assert resp.status_code == 404


async def test_convert_allowed_again_after_product_deleted(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    first = (await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)).json()
    await client.delete(f"/products/{first['id']}", headers=auth_headers)
    resp = await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["id"] != first["id"]


async def test_sync_updates_values_keeps_user_edits(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    product = (await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)).json()
    await client.patch(f"/products/{product['id']}", json={"name": "My mayo", "is_favorite": True}, headers=auth_headers)

    # Salad uses the mayo product
    salad = (await client.post("/meals", json={"name": "Salad", "ingredients": [{"product_id": product["id"], "input_amount": 100}]}, headers=auth_headers)).json()
    assert salad["nutrition"]["per_meal"]["calories"] == pytest.approx(475)

    # Change the mayo recipe: cooked weight 400 g halves per-100g values; add a portion
    await client.patch(f"/meals/{meal['id']}", json={"cooked_weight_grams": 400}, headers=auth_headers)
    await client.post(f"/meals/{meal['id']}/portions", json={"name": "Jar", "grams": 300}, headers=auth_headers)
    resp = await client.post(f"/meals/{meal['id']}/sync-product", headers=auth_headers)
    assert resp.status_code == 200
    synced = resp.json()
    assert synced["id"] == product["id"]
    assert synced["calories"] == pytest.approx(237.5)
    assert synced["name"] == "My mayo" and synced["is_favorite"] is True
    assert [p["name"] for p in synced["portions"]] == ["Jar"]

    salad = (await client.get(f"/meals/{salad['id']}", headers=auth_headers)).json()
    assert salad["nutrition"]["per_meal"]["calories"] == pytest.approx(237.5)


async def test_sync_without_link_404(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    resp = await client.post(f"/meals/{meal['id']}/sync-product", headers=auth_headers)
    assert resp.status_code == 404


async def test_meal_cannot_use_its_own_product(client, auth_headers):
    meal = await _mayo(client, auth_headers)
    product = (await client.post(f"/meals/{meal['id']}/convert-to-product", headers=auth_headers)).json()
    resp = await client.post(
        f"/meals/{meal['id']}/ingredients", json={"product_id": product["id"], "input_amount": 10}, headers=auth_headers
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "circular_ingredient"

    # relinking an existing ingredient is guarded too
    ing_id = meal["ingredients"][0]["id"]
    resp = await client.patch(
        f"/meals/{meal['id']}/ingredients/{ing_id}", json={"product_id": product["id"]}, headers=auth_headers
    )
    assert resp.status_code == 400
