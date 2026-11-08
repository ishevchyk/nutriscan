import uuid

import pytest

from sqlalchemy import delete

from app.models.group import Group
from tests.conftest import TestSessionLocal


async def _register(client, prefix="user"):
    email = f"{prefix}-{uuid.uuid4()}@example.com"
    resp = await client.post("/auth/register", json={"email": email, "password": "testpass123"})
    body = resp.json()
    return email, {"Authorization": f"Bearer {body['access_token']}"}, body["refresh_token"]


async def _user_id(client, headers):
    return (await client.get("/me", headers=headers)).json()["user"]["id"]


ADMIN_ROUTES = [
    ("GET", "/admin/users", None),
    ("PATCH", f"/admin/users/{uuid.uuid4()}", {"disabled": True}),
    ("DELETE", f"/admin/users/{uuid.uuid4()}", None),
    ("GET", "/admin/stats", None),
    ("POST", "/admin/groups", {"name": "Nope"}),
    ("PATCH", f"/admin/groups/{uuid.uuid4()}", {"name": "Nope"}),
]


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("method,path,body", ADMIN_ROUTES)
async def test_admin_routes_reject_non_admin_and_anonymous(client, auth_headers, method, path, body):
    assert (await client.request(method, path, json=body)).status_code in (401, 403)
    resp = await client.request(method, path, json=body, headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_me_shape(client, auth_headers, admin_headers):
    me = (await client.get("/me", headers=auth_headers)).json()
    assert me["user"]["role"] == "user"
    assert me["settings"]["units"] == "metric"
    assert me["profile"]["display_name"] is None
    assert me["goals"] is None
    assert (await client.get("/me", headers=admin_headers)).json()["user"]["role"] == "admin"


@pytest.mark.asyncio(loop_scope="session")
async def test_system_group_create_rename_and_duplicates(client, admin_headers, auth_headers):
    name = f"Sys-{uuid.uuid4().hex[:8]}"
    created = await client.post("/admin/groups", json={"name": name}, headers=admin_headers)
    assert created.status_code == 201 and created.json()["is_system"] is True
    gid = created.json()["id"]
    assert (await client.post("/admin/groups", json={"name": name.upper()}, headers=admin_headers)).status_code == 409

    # Visible to regular users
    assert gid in [g["id"] for g in (await client.get("/groups", headers=auth_headers)).json()]

    renamed = await client.patch(f"/admin/groups/{gid}", json={"name": name + "-x"}, headers=admin_headers)
    assert renamed.status_code == 200 and renamed.json()["name"] == name + "-x"
    # Renaming to its own name is not a conflict
    assert (await client.patch(f"/admin/groups/{gid}", json={"name": name + "-x"}, headers=admin_headers)).status_code == 200

    # System groups are shared across the whole test run (other tests count them)
    async with TestSessionLocal() as session:
        await session.execute(delete(Group).where(Group.id == uuid.UUID(gid)))
        await session.commit()


@pytest.mark.asyncio(loop_scope="session")
async def test_custom_group_cannot_be_renamed_via_admin(client, admin_headers, auth_headers):
    custom = (await client.post("/groups", json={"name": f"Mine-{uuid.uuid4().hex[:6]}"}, headers=auth_headers)).json()
    resp = await client.patch(f"/admin/groups/{custom['id']}", json={"name": "Hijack"}, headers=admin_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_list_users_search_and_pagination(client, admin_headers):
    marker = uuid.uuid4().hex[:10]
    for _ in range(3):
        await _register(client, prefix=f"findme-{marker}")
    resp = await client.get("/admin/users", params={"q": marker, "limit": 2}, headers=admin_headers)
    body = resp.json()
    assert body["total"] == 3 and len(body["items"]) == 2
    assert body["items"][0]["sign_in_methods"] == ["password"]
    page2 = (await client.get("/admin/users", params={"q": marker, "limit": 2, "offset": 2}, headers=admin_headers)).json()
    assert len(page2["items"]) == 1
    # LIKE wildcards are treated literally
    assert (await client.get("/admin/users", params={"q": "%"}, headers=admin_headers)).json()["total"] == 0


@pytest.mark.asyncio(loop_scope="session")
async def test_promote_and_demote(client, admin_headers):
    _, headers, _ = await _register(client)
    uid = await _user_id(client, headers)
    promoted = await client.patch(f"/admin/users/{uid}", json={"role": "admin"}, headers=admin_headers)
    assert promoted.json()["role"] == "admin"
    assert (await client.get("/admin/stats", headers=headers)).status_code == 200
    demoted = await client.patch(f"/admin/users/{uid}", json={"role": "user"}, headers=admin_headers)
    assert demoted.json()["role"] == "user"
    assert (await client.get("/admin/stats", headers=headers)).status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_self_guard(client, admin_headers):
    uid = await _user_id(client, admin_headers)
    for body in ({"role": "user"}, {"disabled": True}):
        resp = await client.patch(f"/admin/users/{uid}", json=body, headers=admin_headers)
        assert resp.status_code == 400
    assert (await client.get("/admin/stats", headers=admin_headers)).status_code == 200


@pytest.mark.asyncio(loop_scope="session")
async def test_unknown_user_404(client, admin_headers):
    resp = await client.patch(f"/admin/users/{uuid.uuid4()}", json={"disabled": True}, headers=admin_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_disable_blocks_everything_and_enable_restores(client, admin_headers):
    email, headers, refresh = await _register(client)
    uid = await _user_id(client, headers)

    resp = await client.patch(f"/admin/users/{uid}", json={"disabled": True}, headers=admin_headers)
    assert resp.status_code == 200 and resp.json()["disabled_at"] is not None

    assert (await client.get("/me", headers=headers)).status_code == 401  # live access token
    assert (await client.post("/auth/refresh", json={"refresh_token": refresh})).status_code == 401
    login = await client.post("/auth/login", json={"email": email, "password": "testpass123"})
    assert login.status_code == 401

    resp = await client.patch(f"/admin/users/{uid}", json={"disabled": False}, headers=admin_headers)
    assert resp.json()["disabled_at"] is None
    login = await client.post("/auth/login", json={"email": email, "password": "testpass123"})
    assert login.status_code == 200


@pytest.mark.asyncio(loop_scope="session")
async def test_disabling_revokes_refresh_tokens_even_if_reenabled(client, admin_headers):
    _, headers, refresh = await _register(client)
    uid = await _user_id(client, headers)
    await client.patch(f"/admin/users/{uid}", json={"disabled": True}, headers=admin_headers)
    await client.patch(f"/admin/users/{uid}", json={"disabled": False}, headers=admin_headers)
    assert (await client.post("/auth/refresh", json={"refresh_token": refresh})).status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_stats(client, admin_headers):
    resp = await client.get("/admin/stats", headers=admin_headers)
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["users_total"] == stats["users_active"] + stats["users_disabled"]
    assert stats["admins"] >= 1 and stats["signups_last_7_days"] >= 1


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_user_purges_data_and_revokes_session(client, admin_headers):
    email, headers, refresh = await _register(client)
    uid = await _user_id(client, headers)
    await client.post("/products", json={"name": "Doomed"}, headers=headers)
    await client.post("/groups", json={"name": "Doomed group"}, headers=headers)

    assert (await client.delete(f"/admin/users/{uid}", headers=admin_headers)).status_code == 204

    assert (await client.get("/me", headers=headers)).status_code == 401
    assert (await client.post("/auth/refresh", json={"refresh_token": refresh})).status_code == 401
    assert (await client.post("/auth/login", json={"email": email, "password": "testpass123"})).status_code == 401
    listed = (await client.get("/admin/users", params={"q": email}, headers=admin_headers)).json()
    assert listed["total"] == 0
    # shared system groups survive
    assert (await client.get("/groups", headers=admin_headers)).json()


@pytest.mark.asyncio(loop_scope="session")
async def test_delete_user_guards(client, admin_headers):
    assert (await client.delete(f"/admin/users/{uuid.uuid4()}", headers=admin_headers)).status_code == 404
    assert (await client.delete(f"/admin/users/{await _user_id(client, admin_headers)}", headers=admin_headers)).status_code == 400

    _, headers, _ = await _register(client)
    uid = await _user_id(client, headers)
    await client.patch(f"/admin/users/{uid}", json={"role": "admin"}, headers=admin_headers)
    assert (await client.delete(f"/admin/users/{uid}", headers=admin_headers)).status_code == 400
    await client.patch(f"/admin/users/{uid}", json={"role": "user"}, headers=admin_headers)
    assert (await client.delete(f"/admin/users/{uid}", headers=admin_headers)).status_code == 204
