import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_product(client, headers, name="Stats Product"):
    resp = await client.post(
        "/products",
        json={"name": name, "calories": 100, "protein": 5, "fat": 2, "carbs": 10},
        headers=headers,
    )
    return resp.json()


async def _log_product(client, headers, product_id, logged_at):
    resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product_id,
            "quantity_grams": 50,
            "meal_slot": "snack",
            "logged_at": logged_at,
        },
        headers=headers,
    )
    assert resp.status_code == 201


async def test_product_not_favorite_by_default(client, auth_headers):
    product = await _create_product(client, auth_headers)
    assert product["is_favorite"] is False
    assert product["log_count"] == 0
    assert product["last_logged_at"] is None


async def test_patch_is_favorite_toggles(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.patch(f"/products/{product['id']}", json={"is_favorite": True}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_favorite"] is True

    listed = (await client.get("/products", headers=auth_headers)).json()
    assert next(p for p in listed if p["id"] == product["id"])["is_favorite"] is True

    resp = await client.patch(f"/products/{product['id']}", json={"is_favorite": False}, headers=auth_headers)
    assert resp.json()["is_favorite"] is False


async def test_patch_is_favorite_null_is_422(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.patch(f"/products/{product['id']}", json={"is_favorite": None}, headers=auth_headers)
    assert resp.status_code == 422


async def test_log_stats_count_direct_and_meal_entries(client, auth_headers):
    product = await _create_product(client, auth_headers, "Logged Product")
    never = await _create_product(client, auth_headers, "Never Logged")
    await _log_product(client, auth_headers, product["id"], "2026-08-01T08:00:00Z")
    await _log_product(client, auth_headers, product["id"], "2026-08-03T08:00:00Z")

    meal = (
        await client.post(
            "/meals",
            json={"name": "Stats Meal", "ingredients": [{"product_id": product["id"], "input_amount": 100}]},
            headers=auth_headers,
        )
    ).json()
    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "meal_slot": "lunch",
            "logged_at": "2026-08-05T12:00:00Z",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201

    listed = {p["id"]: p for p in (await client.get("/products", headers=auth_headers)).json()}
    assert listed[product["id"]]["log_count"] == 3
    assert listed[product["id"]]["last_logged_at"].startswith("2026-08-05T12:00:00")
    assert listed[never["id"]]["log_count"] == 0
    assert listed[never["id"]]["last_logged_at"] is None

    detail = (await client.get(f"/products/{product['id']}", headers=auth_headers)).json()
    assert detail["log_count"] == 3
