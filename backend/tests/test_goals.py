import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_get_goals_before_any_patch_is_404(client, auth_headers):
    resp = await client.get("/goals", headers=auth_headers)
    assert resp.status_code == 404


async def test_patch_goals_creates_on_first_call(client, auth_headers):
    resp = await client.patch(
        "/goals",
        json={"calories_goal": 2000, "protein_goal": 150, "fat_goal": 70, "carbs_goal": 200},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["calories_goal"] == 2000
    assert body["protein_goal"] == 150
    assert body["fat_goal"] == 70
    assert body["carbs_goal"] == 200

    get_resp = await client.get("/goals", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["calories_goal"] == 2000


async def test_patch_goals_updates_existing_row_not_versioned(client, auth_headers):
    first = await client.patch("/goals", json={"calories_goal": 1800}, headers=auth_headers)
    second = await client.patch("/goals", json={"calories_goal": 2200}, headers=auth_headers)
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["calories_goal"] == 2200

    get_resp = await client.get("/goals", headers=auth_headers)
    assert get_resp.json()["calories_goal"] == 2200


async def test_patch_goals_partial_update_leaves_other_fields_untouched(client, auth_headers):
    await client.patch(
        "/goals",
        json={"calories_goal": 2000, "protein_goal": 150, "fat_goal": 70, "carbs_goal": 200},
        headers=auth_headers,
    )
    resp = await client.patch("/goals", json={"protein_goal": 180}, headers=auth_headers)
    body = resp.json()
    assert body["protein_goal"] == 180
    assert body["calories_goal"] == 2000
    assert body["fat_goal"] == 70
    assert body["carbs_goal"] == 200


async def test_goals_are_scoped_per_user(client, auth_headers, second_user_headers):
    await client.patch("/goals", json={"calories_goal": 1500}, headers=auth_headers)
    resp = await client.get("/goals", headers=second_user_headers)
    assert resp.status_code == 404
