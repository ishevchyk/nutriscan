from uuid import UUID

import pytest
from sqlalchemy import delete

from app.models.product import Product
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


async def _create_meal(client, headers, name="Test Meal", ingredients=None, **overrides):
    body = {"name": name, "ingredients": ingredients or []}
    body.update(overrides)
    resp = await client.post("/meals", json=body, headers=headers)
    return resp.json()


async def test_create_meal_with_linked_ingredient_snapshots_product_values(client, auth_headers):
    product = await _create_product(
        client, auth_headers, name="Whole Milk", brand="Farm Co",
        calories=64, protein=3.2, fat=3.6, carbs=4.8, fiber=0, sugar=4.8, salt=0.1,
    )
    resp = await client.post(
        "/meals",
        json={"name": "Milkshake", "ingredients": [{"product_id": product["id"], "input_amount": 200}]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    ing = body["ingredients"][0]
    assert ing["product_id"] == product["id"]
    assert ing["is_linked"] is True
    assert ing["name"] == "Whole Milk"
    assert ing["brand"] == "Farm Co"
    assert ing["calories"] == 64
    assert ing["grams"] == 200
    assert body["nutrition"]["per_meal"]["calories"] == pytest.approx(200 / 100 * 64)


async def test_create_meal_with_manual_ingredient(client, auth_headers):
    resp = await client.post(
        "/meals",
        json={
            "name": "Granola Bowl",
            "ingredients": [
                {
                    "name": "Homemade granola",
                    "brand": None,
                    "input_amount": 80,
                    "calories": 410,
                    "protein": 9,
                    "fat": 14,
                    "carbs": 60,
                    "fiber": 6,
                    "sugar": 18,
                    "salt": 0.2,
                }
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    ing = resp.json()["ingredients"][0]
    assert ing["product_id"] is None
    assert ing["is_linked"] is False
    assert ing["name"] == "Homemade granola"
    assert ing["calories"] == 410


async def test_create_meal_zero_ingredients_no_error(client, auth_headers):
    resp = await client.post("/meals", json={"name": "Empty Meal", "ingredients": []}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["ingredients"] == []
    for macro in ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt"):
        assert body["nutrition"]["per_meal"][macro] == 0
        assert body["nutrition"]["per_100g"][macro] == 0


async def test_unlinked_ingredient_missing_name_422(client, auth_headers):
    resp = await client.post(
        "/meals",
        json={"name": "Bad Meal", "ingredients": [{"input_amount": 50, "calories": 100}]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_meal_defaults_to_one_serving(client, auth_headers):
    resp = await client.post("/meals", json={"name": "Default Servings"}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["servings"] == 1


async def test_create_meal_with_explicit_servings(client, auth_headers):
    resp = await client.post("/meals", json={"name": "Family Meal", "servings": 4}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["servings"] == 4


async def test_patch_meal_servings(client, auth_headers):
    meal = await _create_meal(client, auth_headers, name="Resizable")
    resp = await client.patch(f"/meals/{meal['id']}", json={"servings": 3}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["servings"] == 3


async def test_meal_servings_below_one_422(client, auth_headers):
    resp = await client.post("/meals", json={"name": "Bad", "servings": 0}, headers=auth_headers)
    assert resp.status_code == 422

    meal = await _create_meal(client, auth_headers, name="Patch Bad")
    patch_resp = await client.patch(f"/meals/{meal['id']}", json={"servings": 0}, headers=auth_headers)
    assert patch_resp.status_code == 422


async def test_list_meals_light_shape(client, auth_headers):
    await _create_meal(client, auth_headers, name="Meal A")
    resp = await client.get("/meals", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    assert set(body[0].keys()) == {"id", "name", "photo_url", "updated_at"}


async def test_update_meal_replace_all_ingredients(client, auth_headers):
    product_a = await _create_product(client, auth_headers, name="A", calories=100)
    product_b = await _create_product(client, auth_headers, name="B", calories=200)
    meal = await _create_meal(
        client, auth_headers, name="Swap Test", ingredients=[{"product_id": product_a["id"], "input_amount": 100}]
    )
    assert len(meal["ingredients"]) == 1

    update_resp = await client.patch(
        f"/meals/{meal['id']}",
        json={"ingredients": [{"product_id": product_b["id"], "input_amount": 50}]},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert len(updated["ingredients"]) == 1
    assert updated["ingredients"][0]["product_id"] == product_b["id"]
    assert updated["ingredients"][0]["calories"] == 200


async def test_update_meal_omit_ingredients_leaves_untouched(client, auth_headers):
    product = await _create_product(client, auth_headers)
    meal = await _create_meal(
        client, auth_headers, name="Untouched", ingredients=[{"product_id": product["id"], "input_amount": 100}]
    )

    update_resp = await client.patch(f"/meals/{meal['id']}", json={"name": "Renamed"}, headers=auth_headers)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Renamed"
    assert len(updated["ingredients"]) == 1


async def test_update_meal_clear_ingredients_with_empty_list(client, auth_headers):
    product = await _create_product(client, auth_headers)
    meal = await _create_meal(
        client, auth_headers, name="Clearable", ingredients=[{"product_id": product["id"], "input_amount": 100}]
    )

    update_resp = await client.patch(f"/meals/{meal['id']}", json={"ingredients": []}, headers=auth_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["ingredients"] == []


async def test_create_meal_ingredient_foreign_product_400(client, auth_headers, second_user_headers):
    foreign_product = await _create_product(client, second_user_headers)
    resp = await client.post(
        "/meals",
        json={"name": "Bad", "ingredients": [{"product_id": foreign_product["id"], "input_amount": 50}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_create_meal_ingredient_deleted_product_400(client, auth_headers):
    product = await _create_product(client, auth_headers)
    await client.delete(f"/products/{product['id']}", headers=auth_headers)
    resp = await client.post(
        "/meals",
        json={"name": "Bad", "ingredients": [{"product_id": product["id"], "input_amount": 50}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_meal_ownership_404_on_get_patch_delete(client, auth_headers, second_user_headers):
    meal = await _create_meal(client, second_user_headers, name="Not Yours")

    assert (await client.get(f"/meals/{meal['id']}", headers=auth_headers)).status_code == 404
    assert (
        await client.patch(f"/meals/{meal['id']}", json={"name": "x"}, headers=auth_headers)
    ).status_code == 404
    assert (await client.delete(f"/meals/{meal['id']}", headers=auth_headers)).status_code == 404


async def test_soft_delete_and_restore(client, auth_headers):
    meal = await _create_meal(client, auth_headers, name="Deletable")

    delete_resp = await client.delete(f"/meals/{meal['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    assert (await client.get(f"/meals/{meal['id']}", headers=auth_headers)).status_code == 404
    listed = await client.get("/meals", headers=auth_headers)
    assert all(r["id"] != meal["id"] for r in listed.json())
    deleted = await client.get("/meals/deleted", headers=auth_headers)
    assert any(r["id"] == meal["id"] for r in deleted.json())

    restore_resp = await client.post(f"/meals/{meal['id']}/restore", headers=auth_headers)
    assert restore_resp.status_code == 200
    listed_after = await client.get("/meals", headers=auth_headers)
    assert any(r["id"] == meal["id"] for r in listed_after.json())
    deleted_after = await client.get("/meals/deleted", headers=auth_headers)
    assert all(r["id"] != meal["id"] for r in deleted_after.json())


async def test_deleting_linked_product_unlinks_ingredient_but_keeps_snapshot(client, auth_headers):
    product = await _create_product(client, auth_headers, name="Soon Gone", calories=88)
    meal = await _create_meal(
        client, auth_headers, name="Survives Product Removal",
        ingredients=[{"product_id": product["id"], "input_amount": 100}],
    )

    # Simulate what the 30-day purge job eventually does: hard-delete the
    # product row. purge_expired_soft_deletes() itself is wired to the app's
    # production session factory rather than the test DB (see app/jobs.py /
    # app/database.py), so we exercise the FK behavior it relies on --
    # ondelete="SET NULL" on meal_ingredients.product_id -- directly against
    # the test DB instead of invoking that function here.
    async with TestSessionLocal() as db:
        await db.execute(delete(Product).where(Product.id == UUID(product["id"])))
        await db.commit()

    fetched = await client.get(f"/meals/{meal['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    body = fetched.json()
    ing = body["ingredients"][0]
    assert ing["product_id"] is None
    assert ing["is_linked"] is False
    assert ing["name"] == "Soon Gone"
    assert ing["calories"] == 88
    assert body["nutrition"]["per_meal"]["calories"] == pytest.approx(100 / 100 * 88)


async def test_meal_description_keeps_rich_text_markup(client, auth_headers):
    description = "<h2>Steps</h2><ol><li>Chop</li><li>Fry</li></ol>"
    resp = await client.post(
        "/meals", json={"name": "Structured", "description": description}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["description"] == description


async def test_meal_description_sanitized_on_create_and_update(client, auth_headers):
    resp = await client.post(
        "/meals",
        json={"name": "XSS", "description": '<p>ok</p><script>alert(1)</script>'},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    meal = resp.json()
    assert meal["description"] == "<p>ok</p>"

    patch = await client.patch(
        f"/meals/{meal['id']}",
        json={"description": '<a href="javascript:alert(1)" onclick="x()">link</a>'},
        headers=auth_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["description"] == "<a rel=\"noopener noreferrer\">link</a>"
