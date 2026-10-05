from datetime import datetime, timezone

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _product(client, headers, name="Oats", **extra):
    resp = await client.post("/products", json={"name": name, "calories": 100, "protein": 5, **extra}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _meal(client, headers, ingredients):
    resp = await client.post("/meals", json={"name": "Meal", "ingredients": ingredients}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _get_meal(client, headers, meal_id):
    return (await client.get(f"/meals/{meal_id}", headers=headers)).json()


def _at(hour):
    return datetime(2026, 10, 1, hour, tzinfo=timezone.utc).isoformat()


async def _log_product(client, headers, product_id, grams=100):
    resp = await client.post(
        "/log",
        json={"source_type": "product", "product_id": product_id, "quantity_grams": grams, "meal_slot": "lunch", "logged_at": _at(12)},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---- meals follow products ---------------------------------------------------

async def test_linked_ingredient_follows_product_edits(client, auth_headers):
    product = await _product(client, auth_headers, nutrients={"iron": 4})
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 200}])
    ing = meal["ingredients"][0]
    assert ing["uses_own_values"] is False and ing["calories"] == 100

    await client.patch(
        f"/products/{product['id']}",
        json={"name": "Better Oats", "calories": 150, "nutrients": {"iron": 6}},
        headers=auth_headers,
    )
    after = await _get_meal(client, auth_headers, meal["id"])
    ing = after["ingredients"][0]
    assert ing["name"] == "Better Oats"
    assert ing["calories"] == 150
    assert ing["nutrients"] == {"iron": 6}
    assert after["nutrition"]["per_meal"]["calories"] == pytest.approx(300)  # 200 g * 150/100
    assert after["nutrition"]["per_meal"]["nutrients"] == {"iron": pytest.approx(12)}


async def test_unlinked_ingredient_keeps_own_values(client, auth_headers):
    meal = await _meal(client, auth_headers, [{"name": "Homemade", "input_amount": 100, "calories": 50}])
    ing = meal["ingredients"][0]
    assert ing["uses_own_values"] is True and ing["calories"] == 50 and ing["is_linked"] is False


async def test_editing_linked_ingredient_overrides_and_survives_product_edit(client, auth_headers):
    product = await _product(client, auth_headers, fat=7)
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 100}])
    ing_id = meal["ingredients"][0]["id"]

    resp = await client.patch(f"/meals/{meal['id']}/ingredients/{ing_id}", json={"calories": 80}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    # Partial edit copied the product's current values for the fields not sent.
    assert body["uses_own_values"] is True and body["calories"] == 80 and body["fat"] == 7 and body["is_linked"] is True

    await client.patch(f"/products/{product['id']}", json={"calories": 999}, headers=auth_headers)
    assert (await _get_meal(client, auth_headers, meal["id"]))["ingredients"][0]["calories"] == 80


async def test_relink_to_same_product_resets_to_following(client, auth_headers):
    product = await _product(client, auth_headers)
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 100}])
    ing_id = meal["ingredients"][0]["id"]
    await client.patch(f"/meals/{meal['id']}/ingredients/{ing_id}", json={"calories": 1}, headers=auth_headers)

    resp = await client.patch(
        f"/meals/{meal['id']}/ingredients/{ing_id}", json={"product_id": product["id"]}, headers=auth_headers
    )
    assert resp.json()["uses_own_values"] is False and resp.json()["calories"] == 100
    await client.patch(f"/products/{product['id']}", json={"calories": 120}, headers=auth_headers)
    assert (await _get_meal(client, auth_headers, meal["id"]))["ingredients"][0]["calories"] == 120


async def test_unlink_keeps_current_numbers(client, auth_headers):
    product = await _product(client, auth_headers, nutrients={"zinc": 2})
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 100}])
    ing_id = meal["ingredients"][0]["id"]
    await client.patch(f"/products/{product['id']}", json={"calories": 140}, headers=auth_headers)

    resp = await client.patch(f"/meals/{meal['id']}/ingredients/{ing_id}", json={"product_id": None}, headers=auth_headers)
    body = resp.json()
    assert body["is_linked"] is False and body["uses_own_values"] is True
    assert body["calories"] == 140 and body["nutrients"] == {"zinc": 2}


async def test_soft_deleted_product_still_resolves_in_meal(client, auth_headers):
    product = await _product(client, auth_headers, calories=77)
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 100}])
    await client.delete(f"/products/{product['id']}", headers=auth_headers)
    assert (await _get_meal(client, auth_headers, meal["id"]))["ingredients"][0]["calories"] == 77


# ---- log entries keep their own values --------------------------------------

async def test_product_log_entry_unchanged_after_product_edit(client, auth_headers):
    product = await _product(client, auth_headers, calories=200)
    entry = await _log_product(client, auth_headers, product["id"], grams=50)
    assert entry["macros"]["calories"] == pytest.approx(100) and entry["name"] == "Oats"

    await client.patch(f"/products/{product['id']}", json={"calories": 400, "name": "Renamed"}, headers=auth_headers)
    listed = (await client.get("/log", params={"date": "2026-10-01"}, headers=auth_headers)).json()["lunch"]
    assert listed[0]["macros"]["calories"] == pytest.approx(100)
    assert listed[0]["name"] == "Oats"


async def test_editing_log_quantity_rescales_with_frozen_values(client, auth_headers):
    product = await _product(client, auth_headers, calories=200)
    entry = await _log_product(client, auth_headers, product["id"], grams=50)
    await client.patch(f"/products/{product['id']}", json={"calories": 400}, headers=auth_headers)

    resp = await client.patch(f"/log/{entry['id']}", json={"quantity_grams": 100}, headers=auth_headers)
    assert resp.json()["macros"]["calories"] == pytest.approx(200)


async def test_meal_log_entry_unchanged_after_product_edit(client, auth_headers):
    product = await _product(client, auth_headers, calories=100)
    meal = await _meal(client, auth_headers, [{"product_id": product["id"], "input_amount": 200}])
    resp = await client.post(
        "/log",
        json={"source_type": "meal", "meal_id": meal["id"], "meal_slot": "dinner", "logged_at": _at(19)},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry_id = resp.json()["id"]
    assert resp.json()["macros"]["calories"] == pytest.approx(200)

    await client.patch(f"/products/{product['id']}", json={"calories": 500}, headers=auth_headers)
    listed = (await client.get("/log", params={"date": "2026-10-01"}, headers=auth_headers)).json()["dinner"]
    entry = next(e for e in listed if e["id"] == entry_id)
    assert entry["macros"]["calories"] == pytest.approx(200)
    assert entry["meal_ingredients"][0]["name"] == "Oats"
    # ...while the meal itself now follows the product.
    assert (await _get_meal(client, auth_headers, meal["id"]))["nutrition"]["per_meal"]["calories"] == pytest.approx(1000)


async def test_log_entry_keeps_macros_after_product_is_purged(client, auth_headers):
    from datetime import timedelta
    from uuid import UUID

    from sqlalchemy import update

    from app.jobs import RETENTION_DAYS, purge_expired_soft_deletes
    from app.models.product import Product
    from tests.conftest import TestSessionLocal

    product = await _product(client, auth_headers, calories=300)
    entry = await _log_product(client, auth_headers, product["id"], grams=100)
    await client.delete(f"/products/{product['id']}", headers=auth_headers)
    async with TestSessionLocal() as db:
        await db.execute(
            update(Product)
            .where(Product.id == UUID(product["id"]))
            .values(deleted_at=datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS + 1))
        )
        await db.commit()
    await purge_expired_soft_deletes(session_factory=TestSessionLocal)

    listed = (await client.get("/log", params={"date": "2026-10-01"}, headers=auth_headers)).json()["lunch"]
    kept = next(e for e in listed if e["id"] == entry["id"])
    assert kept["product_id"] is None
    assert kept["macros"]["calories"] == pytest.approx(300)
    assert kept["name"] == "Oats"
