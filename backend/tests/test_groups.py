import pytest

from tests.conftest import SYSTEM_GROUP_NAMES

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_list_groups_returns_system_groups_for_new_user(client, auth_headers):
    resp = await client.get("/groups", headers=auth_headers)
    assert resp.status_code == 200
    groups = resp.json()
    assert len(groups) == len(SYSTEM_GROUP_NAMES)
    assert all(g["is_system"] for g in groups)
    assert {g["name"] for g in groups} == set(SYSTEM_GROUP_NAMES)


async def test_create_group_success(client, auth_headers):
    resp = await client.post("/groups", json={"name": "My Snacks"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "My Snacks"
    assert body["is_system"] is False


async def test_create_group_duplicate_name_case_insensitive_409(client, auth_headers):
    await client.post("/groups", json={"name": "Keto"}, headers=auth_headers)
    resp = await client.post("/groups", json={"name": "KETO"}, headers=auth_headers)
    assert resp.status_code == 409


async def test_create_group_name_trimmed(client, auth_headers):
    resp = await client.post("/groups", json={"name": "  Keto  "}, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Keto"


async def test_create_group_name_too_long_422(client, auth_headers):
    resp = await client.post("/groups", json={"name": "x" * 51}, headers=auth_headers)
    assert resp.status_code == 422


async def test_create_group_empty_name_422(client, auth_headers):
    resp = await client.post("/groups", json={"name": "   "}, headers=auth_headers)
    assert resp.status_code == 422


async def test_rename_group_owned_success(client, auth_headers):
    create = await client.post("/groups", json={"name": "Old Name"}, headers=auth_headers)
    group_id = create.json()["id"]
    resp = await client.patch(f"/groups/{group_id}", json={"name": "New Name"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


async def test_rename_group_not_owned_404(client, auth_headers, second_user_headers):
    create = await client.post("/groups", json={"name": "User A Group"}, headers=auth_headers)
    group_id = create.json()["id"]
    resp = await client.patch(
        f"/groups/{group_id}", json={"name": "Hijacked"}, headers=second_user_headers
    )
    assert resp.status_code == 404


async def test_rename_system_group_400(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    resp = await client.patch(
        f"/groups/{system_group['id']}", json={"name": "Hacked"}, headers=auth_headers
    )
    assert resp.status_code == 400


async def test_rename_nonexistent_group_404(client, auth_headers):
    resp = await client.patch(
        "/groups/00000000-0000-0000-0000-000000000000", json={"name": "X"}, headers=auth_headers
    )
    assert resp.status_code == 404


async def test_delete_group_owned_success(client, auth_headers):
    create = await client.post("/groups", json={"name": "To Delete"}, headers=auth_headers)
    group_id = create.json()["id"]
    resp = await client.delete(f"/groups/{group_id}", headers=auth_headers)
    assert resp.status_code == 204
    groups = (await client.get("/groups", headers=auth_headers)).json()
    assert group_id not in {g["id"] for g in groups}


async def test_delete_group_not_owned_404(client, auth_headers, second_user_headers):
    create = await client.post("/groups", json={"name": "User A Group 2"}, headers=auth_headers)
    group_id = create.json()["id"]
    resp = await client.delete(f"/groups/{group_id}", headers=second_user_headers)
    assert resp.status_code == 404


async def test_delete_system_group_400(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    resp = await client.delete(f"/groups/{system_group['id']}", headers=auth_headers)
    assert resp.status_code == 400


async def test_delete_nonexistent_group_404(client, auth_headers):
    resp = await client.delete("/groups/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_group_cascades_product_group_rows(client, auth_headers):
    group = (
        await client.post("/groups", json={"name": "Cascade Group"}, headers=auth_headers)
    ).json()
    product = (
        await client.post("/products", json={"name": "Cascade Product"}, headers=auth_headers)
    ).json()
    await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )
    resp = await client.delete(f"/groups/{group['id']}", headers=auth_headers)
    assert resp.status_code == 204

    fetched = await client.get(f"/products/{product['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["groups"] == []
