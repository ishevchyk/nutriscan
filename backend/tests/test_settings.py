import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_get_settings_before_any_patch_returns_defaults(client, auth_headers):
    resp = await client.get("/settings", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["units"] == "metric"
    assert body["timezone"] == "UTC"
    assert body["notifications_enabled"] is True
    assert body["updated_at"] is None


async def test_patch_settings_creates_on_first_call(client, auth_headers):
    resp = await client.patch(
        "/settings",
        json={"units": "imperial", "timezone": "America/New_York", "notifications_enabled": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["units"] == "imperial"
    assert body["timezone"] == "America/New_York"
    assert body["notifications_enabled"] is False
    assert body["updated_at"] is not None

    get_resp = await client.get("/settings", headers=auth_headers)
    assert get_resp.json()["timezone"] == "America/New_York"


async def test_patch_settings_updates_existing_row(client, auth_headers):
    await client.patch("/settings", json={"units": "imperial"}, headers=auth_headers)
    resp = await client.patch("/settings", json={"units": "metric"}, headers=auth_headers)
    assert resp.json()["units"] == "metric"

    get_resp = await client.get("/settings", headers=auth_headers)
    assert get_resp.json()["units"] == "metric"


async def test_patch_settings_partial_update_leaves_other_fields_untouched(client, auth_headers):
    await client.patch(
        "/settings",
        json={"units": "imperial", "timezone": "America/New_York", "notifications_enabled": False},
        headers=auth_headers,
    )
    resp = await client.patch("/settings", json={"notifications_enabled": True}, headers=auth_headers)
    body = resp.json()
    assert body["notifications_enabled"] is True
    assert body["units"] == "imperial"
    assert body["timezone"] == "America/New_York"


async def test_patch_settings_invalid_units_422(client, auth_headers):
    resp = await client.patch("/settings", json={"units": "furlongs"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_patch_settings_invalid_timezone_422(client, auth_headers):
    resp = await client.patch("/settings", json={"timezone": "Not/A_Zone"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_settings_are_scoped_per_user(client, auth_headers, second_user_headers):
    await client.patch("/settings", json={"units": "imperial"}, headers=auth_headers)
    resp = await client.get("/settings", headers=second_user_headers)
    assert resp.json()["units"] == "metric"
