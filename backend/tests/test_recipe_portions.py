import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_recipe(client, headers, name="Test Recipe", ingredients=None):
    resp = await client.post("/recipes", json={"name": name, "ingredients": ingredients or []}, headers=headers)
    return resp.json()


async def test_create_list_update_delete_portion(client, auth_headers):
    recipe = await _create_recipe(
        client, auth_headers, ingredients=[{"name": "Base", "grams": 100, "calories": 200}]
    )

    create_resp = await client.post(
        f"/recipes/{recipe['id']}/portions",
        json={"name": "Slice", "grams": 50},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    portion = create_resp.json()
    assert portion["name"] == "Slice"
    assert portion["grams"] == 50
    assert portion["is_default"] is False

    list_resp = await client.get(f"/recipes/{recipe['id']}/portions", headers=auth_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    update_resp = await client.patch(
        f"/recipes/{recipe['id']}/portions/{portion['id']}",
        json={"name": "Half Slice", "grams": 25},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Half Slice"
    assert updated["grams"] == 25

    delete_resp = await client.delete(f"/recipes/{recipe['id']}/portions/{portion['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204
    list_after = await client.get(f"/recipes/{recipe['id']}/portions", headers=auth_headers)
    assert list_after.json() == []


async def test_create_portion_grams_zero_or_negative_422(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    resp = await client.post(
        f"/recipes/{recipe['id']}/portions", json={"name": "Bad", "grams": -5}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_update_portion_grams_zero_422(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    portion = (
        await client.post(
            f"/recipes/{recipe['id']}/portions", json={"name": "Ok", "grams": 10}, headers=auth_headers
        )
    ).json()
    resp = await client.patch(
        f"/recipes/{recipe['id']}/portions/{portion['id']}", json={"grams": 0}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_setting_is_default_unsets_previous_default(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    first = (
        await client.post(
            f"/recipes/{recipe['id']}/portions",
            json={"name": "First", "grams": 10, "is_default": True},
            headers=auth_headers,
        )
    ).json()
    second = (
        await client.post(
            f"/recipes/{recipe['id']}/portions",
            json={"name": "Second", "grams": 20, "is_default": True},
            headers=auth_headers,
        )
    ).json()

    portions = (await client.get(f"/recipes/{recipe['id']}/portions", headers=auth_headers)).json()
    by_id = {p["id"]: p for p in portions}
    assert by_id[first["id"]]["is_default"] is False
    assert by_id[second["id"]]["is_default"] is True


async def test_update_is_default_true_unsets_others(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    first = (
        await client.post(
            f"/recipes/{recipe['id']}/portions",
            json={"name": "First", "grams": 10, "is_default": True},
            headers=auth_headers,
        )
    ).json()
    second = (
        await client.post(
            f"/recipes/{recipe['id']}/portions", json={"name": "Second", "grams": 20}, headers=auth_headers
        )
    ).json()

    await client.patch(
        f"/recipes/{recipe['id']}/portions/{second['id']}", json={"is_default": True}, headers=auth_headers
    )

    portions = (await client.get(f"/recipes/{recipe['id']}/portions", headers=auth_headers)).json()
    by_id = {p["id"]: p for p in portions}
    assert by_id[first["id"]]["is_default"] is False
    assert by_id[second["id"]]["is_default"] is True


async def test_portion_ownership_404(client, auth_headers, second_user_headers):
    recipe = await _create_recipe(client, second_user_headers)
    portion = (
        await client.post(
            f"/recipes/{recipe['id']}/portions", json={"name": "Not Yours", "grams": 10}, headers=second_user_headers
        )
    ).json()

    assert (
        await client.get(f"/recipes/{recipe['id']}/portions", headers=auth_headers)
    ).status_code == 404
    assert (
        await client.patch(
            f"/recipes/{recipe['id']}/portions/{portion['id']}", json={"grams": 5}, headers=auth_headers
        )
    ).status_code == 404
    assert (
        await client.delete(f"/recipes/{recipe['id']}/portions/{portion['id']}", headers=auth_headers)
    ).status_code == 404


async def test_delete_portion_is_hard_delete_no_restore(client, auth_headers):
    recipe = await _create_recipe(client, auth_headers)
    portion = (
        await client.post(
            f"/recipes/{recipe['id']}/portions", json={"name": "Gone", "grams": 10}, headers=auth_headers
        )
    ).json()

    delete_resp = await client.delete(f"/recipes/{recipe['id']}/portions/{portion['id']}", headers=auth_headers)
    assert delete_resp.status_code == 204

    assert (
        await client.patch(
            f"/recipes/{recipe['id']}/portions/{portion['id']}", json={"grams": 1}, headers=auth_headers
        )
    ).status_code == 404
    assert (
        await client.delete(f"/recipes/{recipe['id']}/portions/{portion['id']}", headers=auth_headers)
    ).status_code == 404


async def test_embedded_portion_nutrition_matches_per_100g_times_grams(client, auth_headers):
    recipe = await _create_recipe(
        client, auth_headers,
        ingredients=[{"name": "Base", "grams": 100, "calories": 200, "protein": 10, "fat": 5, "carbs": 20, "fiber": 2, "sugar": 5, "salt": 0.5}],
    )
    portion = (
        await client.post(
            f"/recipes/{recipe['id']}/portions", json={"name": "Half", "grams": 50}, headers=auth_headers
        )
    ).json()

    fetched = (await client.get(f"/recipes/{recipe['id']}", headers=auth_headers)).json()
    embedded = next(p for p in fetched["portions"] if p["id"] == portion["id"])
    per_100g = fetched["nutrition"]["per_100g"]
    assert embedded["nutrition"]["calories"] == pytest.approx(per_100g["calories"] * 50 / 100)
    assert embedded["nutrition"]["protein"] == pytest.approx(per_100g["protein"] * 50 / 100)
