import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

TEST_DATE = "2026-08-20"


def _logged_at(hour: int) -> str:
    return f"{TEST_DATE}T{hour:02d}:00:00Z"


async def _create_product(client, headers, name="Test Product", **overrides):
    body = {"name": name, "calories": 100, "protein": 5, "fat": 2, "carbs": 10}
    body.update(overrides)
    resp = await client.post("/products", json=body, headers=headers)
    return resp.json()


async def _create_meal(client, headers, name="Test Meal", ingredients=None):
    resp = await client.post(
        "/meals", json={"name": name, "ingredients": ingredients or []}, headers=headers
    )
    return resp.json()


async def _create_portion(client, headers, meal_id, name, grams):
    resp = await client.post(f"/meals/{meal_id}/portions", json={"name": name, "grams": grams}, headers=headers)
    return resp.json()


async def test_create_and_list_product_log_entry(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product["id"],
            "quantity_grams": 50,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["source_type"] == "product"
    assert entry["macros"]["calories"] == pytest.approx(100)
    assert entry["macros"]["protein"] == pytest.approx(5)

    list_resp = await client.get(f"/log?date={TEST_DATE}", headers=auth_headers)
    assert list_resp.status_code == 200
    grouped = list_resp.json()
    assert set(grouped.keys()) == {"breakfast", "lunch", "dinner", "snack"}
    assert len(grouped["breakfast"]) == 1
    assert grouped["breakfast"][0]["id"] == entry["id"]
    assert grouped["lunch"] == []


async def test_create_manual_log_entry(client, auth_headers):
    resp = await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 350,
            "manual_protein": 20,
            "manual_fat": 15,
            "manual_carbs": 40,
            "meal_slot": "dinner",
            "logged_at": _logged_at(19),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["macros"] == {"calories": 350, "protein": 20, "fat": 15, "carbs": 40}


async def test_create_product_log_entry_with_manual_fields_is_422(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product["id"],
            "quantity_grams": 50,
            "manual_calories": 100,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_meal_log_entry_no_portion_uses_full_meal_grams(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["macros"]["calories"] == pytest.approx(400)  # 200g/100 * 200
    assert entry["meal_ingredients"] == [{"product_id": product["id"], "grams": 200}]
    # quantity_grams is the dish's logged weight (reference weight here, since
    # there's no cooked_weight_grams) -- separate from meal_ingredients, which is
    # only a raw-ingredient-equivalent breakdown for the macro calc.
    assert entry["quantity_grams"] == pytest.approx(200)


async def test_create_meal_log_entry_with_portion_scales_grams(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    portion = await _create_portion(client, auth_headers, meal["id"], "Half", 100)

    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "portion_id": portion["id"],
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    # portion is half the meal's total grams (100 of 200) -> ingredient scales to 100g
    assert entry["meal_ingredients"] == [{"product_id": product["id"], "grams": 100}]
    assert entry["macros"]["calories"] == pytest.approx(200)  # 100g/100 * 200
    # quantity_grams is the portion's own weight, exactly -- not derived from
    # the (raw-ingredient-equivalent) meal_ingredients snapshot.
    assert entry["quantity_grams"] == pytest.approx(100)


async def test_create_meal_log_entry_with_portion_scales_against_cooked_weight(client, auth_headers):
    # Raw ingredients total 200g, but the dish is recorded as weighing 100g once
    # cooked (water loss) -- a "Half" portion of 50g should mean half of the
    # *cooked* dish, scaling ingredients to 50% (100g raw), not 25% (50/200).
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    await client.patch(f"/meals/{meal['id']}", json={"cooked_weight_grams": 100}, headers=auth_headers)
    portion = await _create_portion(client, auth_headers, meal["id"], "Half", 50)

    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "portion_id": portion["id"],
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    assert entry["meal_ingredients"] == [{"product_id": product["id"], "grams": 100}]
    assert entry["macros"]["calories"] == pytest.approx(200)  # 100g/100 * 200
    # The displayed logged amount is the portion's actual weight (50g of the
    # cooked dish) -- distinct from the 100g raw-ingredient-equivalent snapshot
    # above, which exists only to drive the macro calc.
    assert entry["quantity_grams"] == pytest.approx(50)


async def test_create_meal_log_entry_quantity_grams_explicit_overrides_default(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    portion = await _create_portion(client, auth_headers, meal["id"], "Half", 100)

    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "portion_id": portion["id"],
            "quantity_grams": 123,
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    # An explicit quantity_grams wins over the portion-derived default.
    assert entry["quantity_grams"] == pytest.approx(123)


async def test_update_meal_entry_quantity_grams(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"quantity_grams": 250}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["quantity_grams"] == pytest.approx(250)


async def test_create_meal_log_entry_with_ingredient_overrides(client, auth_headers):
    cheese = await _create_product(client, auth_headers, name="Cheese", calories=400, protein=25, fat=33, carbs=1)
    bread = await _create_product(client, auth_headers, name="Bread", calories=265, protein=9, fat=3, carbs=49)
    meal = await _create_meal(
        client,
        auth_headers,
        ingredients=[
            {"product_id": cheese["id"], "input_amount": 70},
            {"product_id": bread["id"], "input_amount": 100},
        ],
    )

    resp = await client.post(
        "/log",
        json={
            "source_type": "meal",
            "meal_id": meal["id"],
            "ingredient_overrides": [{"product_id": cheese["id"], "grams": 50}],
            "meal_slot": "lunch",
            "logged_at": _logged_at(12),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry = resp.json()
    # overrides replace the snapshot entirely -- bread is dropped, not scaled
    assert entry["meal_ingredients"] == [{"product_id": cheese["id"], "grams": 50}]
    assert entry["macros"]["calories"] == pytest.approx(50 / 100 * 400)


async def test_create_meal_log_entry_with_unlinked_ingredient_is_422(client, auth_headers):
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"name": "Homemade sauce", "input_amount": 50, "calories": 80}]
    )
    resp = await client.post(
        "/log",
        json={"source_type": "meal", "meal_id": meal["id"], "meal_slot": "lunch", "logged_at": _logged_at(12)},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_update_manual_log_entry_fields(client, auth_headers):
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 10,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "snack",
            "logged_at": _logged_at(16),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"manual_calories": 500}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["macros"]["calories"] == 500
    assert resp.json()["macros"]["protein"] == 10  # untouched


async def test_update_manual_field_on_product_entry_is_422(client, auth_headers):
    product = await _create_product(client, auth_headers)
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product["id"],
            "quantity_grams": 50,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"manual_calories": 500}, headers=auth_headers)
    assert resp.status_code == 422


async def test_update_log_entry_cannot_change_source_type(client, auth_headers):
    product = await _create_product(client, auth_headers)
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product["id"],
            "quantity_grams": 50,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"source_type": "manual"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_update_quantity_grams_on_product_entry(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200)
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "product",
            "product_id": product["id"],
            "quantity_grams": 50,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"quantity_grams": 100}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["macros"]["calories"] == pytest.approx(200)


async def test_update_quantity_grams_on_manual_entry_is_422(client, auth_headers):
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 20,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    resp = await client.patch(f"/log/{entry_id}", json={"quantity_grams": 100}, headers=auth_headers)
    assert resp.status_code == 422


async def test_update_ingredient_overrides_on_meal_entry(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    create_resp = await client.post(
        "/log",
        json={"source_type": "meal", "meal_id": meal["id"], "meal_slot": "lunch", "logged_at": _logged_at(12)},
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]
    assert create_resp.json()["macros"]["calories"] == pytest.approx(400)

    resp = await client.patch(
        f"/log/{entry_id}",
        json={"ingredient_overrides": [{"product_id": product["id"], "grams": 50}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["macros"]["calories"] == pytest.approx(100)


async def test_delete_log_entry(client, auth_headers):
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 100,
            "manual_protein": 5,
            "manual_fat": 5,
            "manual_carbs": 5,
            "meal_slot": "snack",
            "logged_at": _logged_at(16),
        },
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/log/{entry_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_resp = await client.get(f"/log?date={TEST_DATE}", headers=auth_headers)
    all_ids = [e["id"] for entries in list_resp.json().values() for e in entries]
    assert entry_id not in all_ids

    assert (await client.delete(f"/log/{entry_id}", headers=auth_headers)).status_code == 404


async def test_log_entry_ownership_404(client, auth_headers, second_user_headers):
    create_resp = await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 100,
            "manual_protein": 5,
            "manual_fat": 5,
            "manual_carbs": 5,
            "meal_slot": "snack",
            "logged_at": _logged_at(16),
        },
        headers=second_user_headers,
    )
    entry_id = create_resp.json()["id"]

    assert (
        await client.patch(f"/log/{entry_id}", json={"manual_calories": 1}, headers=auth_headers)
    ).status_code == 404
    assert (await client.delete(f"/log/{entry_id}", headers=auth_headers)).status_code == 404


async def test_soft_deleting_logged_meal_does_not_affect_existing_log_entry_macros(client, auth_headers):
    product = await _create_product(client, auth_headers, calories=200, protein=10, fat=5, carbs=20)
    meal = await _create_meal(
        client, auth_headers, ingredients=[{"product_id": product["id"], "input_amount": 200}]
    )
    create_resp = await client.post(
        "/log",
        json={"source_type": "meal", "meal_id": meal["id"], "meal_slot": "lunch", "logged_at": _logged_at(12)},
        headers=auth_headers,
    )
    entry_id = create_resp.json()["id"]
    assert create_resp.json()["macros"]["calories"] == pytest.approx(400)

    delete_resp = await client.delete(f"/meals/{meal['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    list_resp = await client.get(f"/log?date={TEST_DATE}", headers=auth_headers)
    entry = next(e for e in list_resp.json()["lunch"] if e["id"] == entry_id)
    assert entry["macros"]["calories"] == pytest.approx(400)


async def test_log_summary_totals_and_goals(client, auth_headers):
    await client.patch(
        "/goals",
        json={"calories_goal": 2000, "protein_goal": 150, "fat_goal": 70, "carbs_goal": 200},
        headers=auth_headers,
    )
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 20,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 500,
            "manual_protein": 30,
            "manual_fat": 20,
            "manual_carbs": 60,
            "meal_slot": "dinner",
            "logged_at": _logged_at(19),
        },
        headers=auth_headers,
    )

    resp = await client.get(f"/log/summary?date={TEST_DATE}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["totals"]["calories"] == pytest.approx(800)
    assert body["totals"]["protein"] == pytest.approx(50)
    assert body["goals"]["calories"] == 2000


async def test_log_summary_goals_null_when_none_set(client, auth_headers):
    resp = await client.get(f"/log/summary?date={TEST_DATE}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["goals"] is None
    assert body["totals"] == {"calories": 0, "protein": 0, "fat": 0, "carbs": 0}


async def test_logged_days_returns_days_with_entries(client, auth_headers):
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 20,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),  # 2026-08-20
        },
        headers=auth_headers,
    )
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 400,
            "manual_protein": 25,
            "manual_fat": 12,
            "manual_carbs": 35,
            "meal_slot": "dinner",
            "logged_at": "2026-08-05T19:00:00Z",
        },
        headers=auth_headers,
    )
    # Outside the queried month -- must not show up.
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 100,
            "manual_protein": 5,
            "manual_fat": 2,
            "manual_carbs": 10,
            "meal_slot": "snack",
            "logged_at": "2026-09-05T12:00:00Z",
        },
        headers=auth_headers,
    )

    resp = await client.get("/log/logged-days?year=2026&month=8", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["days"] == [5, 20]


async def test_logged_days_empty_month_returns_empty_list(client, auth_headers):
    resp = await client.get("/log/logged-days?year=2026&month=8", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["days"] == []


async def test_logged_days_scoped_to_current_user(client, auth_headers, second_user_headers):
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 20,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "breakfast",
            "logged_at": _logged_at(8),
        },
        headers=auth_headers,
    )
    resp = await client.get("/log/logged-days?year=2026&month=8", headers=second_user_headers)
    assert resp.status_code == 200
    assert resp.json()["days"] == []


async def test_log_day_boundary_respects_user_settings_timezone(client, auth_headers):
    # 2026-08-21T02:00:00Z is 2026-08-20T22:00:00 in America/New_York (EDT,
    # UTC-4 in August) -- with the user's timezone set, it must land on the
    # local day (Aug 20), not the UTC day (Aug 21).
    await client.patch("/settings", json={"timezone": "America/New_York"}, headers=auth_headers)
    await client.post(
        "/log",
        json={
            "source_type": "manual",
            "manual_calories": 300,
            "manual_protein": 20,
            "manual_fat": 10,
            "manual_carbs": 30,
            "meal_slot": "breakfast",
            "logged_at": "2026-08-21T02:00:00Z",
        },
        headers=auth_headers,
    )

    local_day = await client.get("/log?date=2026-08-20", headers=auth_headers)
    assert len(local_day.json()["breakfast"]) == 1

    utc_day = await client.get("/log?date=2026-08-21", headers=auth_headers)
    assert utc_day.json()["breakfast"] == []

    summary = await client.get("/log/summary?date=2026-08-20", headers=auth_headers)
    assert summary.json()["totals"]["calories"] == pytest.approx(300)

    logged_days = await client.get("/log/logged-days?year=2026&month=8", headers=auth_headers)
    assert logged_days.json()["days"] == [20]
