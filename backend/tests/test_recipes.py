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


async def _create_recipe(client, headers, name="Test Recipe", ingredients=None, **overrides):
    body = {"name": name, "ingredients": ingredients or []}
    body.update(overrides)
    resp = await client.post("/recipes", json=body, headers=headers)
    return resp.json()


async def test_create_recipe_with_linked_ingredient_snapshots_product_values(client, auth_headers):
    product = await _create_product(
        client, auth_headers, name="Whole Milk", brand="Farm Co",
        calories=64, protein=3.2, fat=3.6, carbs=4.8, fiber=0, sugar=4.8, salt=0.1,
    )
    resp = await client.post(
        "/recipes",
        json={"name": "Milkshake", "ingredients": [{"product_id": product["id"], "grams": 200}]},
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


async def test_create_recipe_with_manual_ingredient(client, auth_headers):
    resp = await client.post(
        "/recipes",
        json={
            "name": "Granola Bowl",
            "ingredients": [
                {
                    "name": "Homemade granola",
                    "brand": None,
                    "grams": 80,
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


async def test_create_recipe_zero_ingredients_no_error(client, auth_headers):
    resp = await client.post("/recipes", json={"name": "Empty Recipe", "ingredients": []}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["ingredients"] == []
    for macro in ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt"):
        assert body["nutrition"]["per_meal"][macro] == 0
        assert body["nutrition"]["per_100g"][macro] == 0


async def test_unlinked_ingredient_missing_name_422(client, auth_headers):
    resp = await client.post(
        "/recipes",
        json={"name": "Bad Recipe", "ingredients": [{"grams": 50, "calories": 100}]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_recipes_light_shape(client, auth_headers):
    await _create_recipe(client, auth_headers, name="Recipe A")
    resp = await client.get("/recipes", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    assert set(body[0].keys()) == {"id", "name", "photo_url", "updated_at"}


async def test_update_recipe_replace_all_ingredients(client, auth_headers):
    product_a = await _create_product(client, auth_headers, name="A", calories=100)
    product_b = await _create_product(client, auth_headers, name="B", calories=200)
    recipe = await _create_recipe(
        client, auth_headers, name="Swap Test", ingredients=[{"product_id": product_a["id"], "grams": 100}]
    )
    assert len(recipe["ingredients"]) == 1

    update_resp = await client.patch(
        f"/recipes/{recipe['id']}",
        json={"ingredients": [{"product_id": product_b["id"], "grams": 50}]},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert len(updated["ingredients"]) == 1
    assert updated["ingredients"][0]["product_id"] == product_b["id"]
    assert updated["ingredients"][0]["calories"] == 200


async def test_update_recipe_omit_ingredients_leaves_untouched(client, auth_headers):
    product = await _create_product(client, auth_headers)
    recipe = await _create_recipe(
        client, auth_headers, name="Untouched", ingredients=[{"product_id": product["id"], "grams": 100}]
    )

    update_resp = await client.patch(f"/recipes/{recipe['id']}", json={"name": "Renamed"}, headers=auth_headers)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Renamed"
    assert len(updated["ingredients"]) == 1


async def test_update_recipe_clear_ingredients_with_empty_list(client, auth_headers):
    product = await _create_product(client, auth_headers)
    recipe = await _create_recipe(
        client, auth_headers, name="Clearable", ingredients=[{"product_id": product["id"], "grams": 100}]
    )

    update_resp = await client.patch(f"/recipes/{recipe['id']}", json={"ingredients": []}, headers=auth_headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["ingredients"] == []


async def test_create_recipe_ingredient_foreign_product_400(client, auth_headers, second_user_headers):
    foreign_product = await _create_product(client, second_user_headers)
    resp = await client.post(
        "/recipes",
        json={"name": "Bad", "ingredients": [{"product_id": foreign_product["id"], "grams": 50}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_create_recipe_ingredient_deleted_product_400(client, auth_headers):
    product = await _create_product(client, auth_headers)
    await client.delete(f"/products/{product['id']}", headers=auth_headers)
    resp = await client.post(
        "/recipes",
        json={"name": "Bad", "ingredients": [{"product_id": product["id"], "grams": 50}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_recipe_ownership_404_on_get_patch_delete(client, auth_headers, second_user_headers):
    recipe = await _create_recipe(client, second_user_headers, name="Not Yours")

    assert (await client.get(f"/recipes/{recipe['id']}", headers=auth_headers)).status_code == 404
    assert (
        await client.patch(f"/recipes/{recipe['id']}", json={"name": "x"}, headers=auth_headers)
    ).status_code == 404
    assert (await client.delete(f"/recipes/{recipe['id']}", headers=auth_headers)).status_code == 404


async def test_soft_delete_and_restore(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers, name="Deletable")

    delete_resp = await client.delete(f"/recipes/{recipe['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    assert (await client.get(f"/recipes/{recipe['id']}", headers=auth_headers)).status_code == 404
    listed = await client.get("/recipes", headers=auth_headers)
    assert all(r["id"] != recipe["id"] for r in listed.json())
    deleted = await client.get("/recipes/deleted", headers=auth_headers)
    assert any(r["id"] == recipe["id"] for r in deleted.json())

    restore_resp = await client.post(f"/recipes/{recipe['id']}/restore", headers=auth_headers)
    assert restore_resp.status_code == 200
    listed_after = await client.get("/recipes", headers=auth_headers)
    assert any(r["id"] == recipe["id"] for r in listed_after.json())
    deleted_after = await client.get("/recipes/deleted", headers=auth_headers)
    assert all(r["id"] != recipe["id"] for r in deleted_after.json())


async def test_deleting_linked_product_unlinks_ingredient_but_keeps_snapshot(client, auth_headers):
    product = await _create_product(client, auth_headers, name="Soon Gone", calories=88)
    recipe = await _create_recipe(
        client, auth_headers, name="Survives Product Removal",
        ingredients=[{"product_id": product["id"], "grams": 100}],
    )

    # Simulate what the 30-day purge job eventually does: hard-delete the
    # product row. purge_expired_soft_deletes() itself is wired to the app's
    # production session factory rather than the test DB (see app/jobs.py /
    # app/database.py), so we exercise the FK behavior it relies on --
    # ondelete="SET NULL" on recipe_ingredients.product_id -- directly against
    # the test DB instead of invoking that function here.
    async with TestSessionLocal() as db:
        await db.execute(delete(Product).where(Product.id == UUID(product["id"])))
        await db.commit()

    fetched = await client.get(f"/recipes/{recipe['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    body = fetched.json()
    ing = body["ingredients"][0]
    assert ing["product_id"] is None
    assert ing["is_linked"] is False
    assert ing["name"] == "Soon Gone"
    assert ing["calories"] == 88
    assert body["nutrition"]["per_meal"]["calories"] == pytest.approx(100 / 100 * 88)
