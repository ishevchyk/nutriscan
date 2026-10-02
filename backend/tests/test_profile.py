import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_get_profile_before_any_patch_returns_all_null(client, auth_headers):
    resp = await client.get("/profile", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["display_name"] is None
    assert body["date_of_birth"] is None
    assert body["sex"] is None
    assert body["height_cm"] is None
    assert body["weight_kg"] is None
    assert body["activity_level"] is None
    assert body["updated_at"] is None
    assert body["email"]


async def test_patch_profile_creates_on_first_call(client, auth_headers):
    resp = await client.patch(
        "/profile",
        json={
            "display_name": "Iryna Shevchyk",
            "date_of_birth": "1991-05-14",
            "sex": "prefer_not_to_say",
            "height_cm": 168,
            "weight_kg": 64,
            "activity_level": "moderate",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["display_name"] == "Iryna Shevchyk"
    assert body["date_of_birth"] == "1991-05-14"
    assert body["sex"] == "prefer_not_to_say"
    assert body["height_cm"] == 168
    assert body["weight_kg"] == 64
    assert body["activity_level"] == "moderate"
    assert body["updated_at"] is not None

    get_resp = await client.get("/profile", headers=auth_headers)
    assert get_resp.json()["display_name"] == "Iryna Shevchyk"


async def test_patch_profile_partial_update_leaves_other_fields_untouched(client, auth_headers):
    await client.patch(
        "/profile",
        json={"display_name": "Original Name", "height_cm": 170},
        headers=auth_headers,
    )
    resp = await client.patch("/profile", json={"height_cm": 175}, headers=auth_headers)
    body = resp.json()
    assert body["height_cm"] == 175
    assert body["display_name"] == "Original Name"


async def test_patch_profile_invalid_sex_422(client, auth_headers):
    resp = await client.patch("/profile", json={"sex": "not-a-real-value"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_patch_profile_invalid_activity_level_422(client, auth_headers):
    resp = await client.patch("/profile", json={"activity_level": "superhuman"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_profile_is_scoped_per_user(client, auth_headers, second_user_headers):
    await client.patch("/profile", json={"display_name": "User One"}, headers=auth_headers)
    resp = await client.get("/profile", headers=second_user_headers)
    assert resp.json()["display_name"] is None
