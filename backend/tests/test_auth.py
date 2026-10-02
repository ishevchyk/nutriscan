import uuid

import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _register(client, password="testpass123"):
    email = f"test-{uuid.uuid4()}@example.com"
    resp = await client.post("/auth/register", json={"email": email, "password": password})
    body = resp.json()
    return {
        "email": email,
        "password": password,
        "access_token": body["access_token"],
        "refresh_token": body["refresh_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


async def test_change_password_wrong_current_password_401(client):
    user = await _register(client)
    resp = await client.post(
        "/auth/change-password",
        json={"current_password": "wrongpassword", "new_password": "newpass123"},
        headers=user["headers"],
    )
    assert resp.status_code == 401


async def test_change_password_too_short_422(client):
    user = await _register(client)
    resp = await client.post(
        "/auth/change-password",
        json={"current_password": user["password"], "new_password": "short"},
        headers=user["headers"],
    )
    assert resp.status_code == 422


async def test_change_password_success_and_new_password_works(client):
    user = await _register(client)
    resp = await client.post(
        "/auth/change-password",
        json={"current_password": user["password"], "new_password": "brandnewpass123"},
        headers=user["headers"],
    )
    assert resp.status_code == 204

    old_login = await client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    assert old_login.status_code == 401

    new_login = await client.post(
        "/auth/login", json={"email": user["email"], "password": "brandnewpass123"}
    )
    assert new_login.status_code == 200


async def test_delete_account_removes_user_data_and_revokes_session(client):
    user = await _register(client)
    headers = user["headers"]

    product = await client.post("/products", json={"name": "Test Product"}, headers=headers)
    assert product.status_code in (200, 201)
    group = await client.post("/groups", json={"name": "My Custom Group"}, headers=headers)
    assert group.status_code == 201
    await client.patch("/goals", json={"calories_goal": 2000}, headers=headers)
    await client.patch("/settings", json={"units": "imperial"}, headers=headers)
    await client.patch("/profile", json={"display_name": "Test User"}, headers=headers)

    resp = await client.delete("/auth/me", headers=headers)
    assert resp.status_code == 204

    # The access token's underlying user row is gone, so authenticated
    # endpoints now 401 instead of returning the (now-deleted) user's data.
    products_after = await client.get("/products", headers=headers)
    assert products_after.status_code == 401

    # The refresh token was deleted as part of the purge, so it can't be
    # used to mint a new session either.
    refresh_after = await client.post("/auth/refresh", json={"refresh_token": user["refresh_token"]})
    assert refresh_after.status_code == 401

    login_after = await client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    assert login_after.status_code == 401


async def test_delete_account_does_not_remove_system_groups(client, auth_headers):
    from tests.conftest import SYSTEM_GROUP_NAMES

    user = await _register(client)
    await client.delete("/auth/me", headers=user["headers"])

    # System groups are shared across all users (user_id is NULL) and must
    # survive another user's account deletion.
    resp = await client.get("/groups", headers=auth_headers)
    assert resp.status_code == 200
    assert {g["name"] for g in resp.json() if g["is_system"]} == set(SYSTEM_GROUP_NAMES)
