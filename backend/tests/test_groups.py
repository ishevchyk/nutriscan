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


async def test_list_groups_excludes_hidden_by_default(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])

    hide_resp = await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)
    assert hide_resp.status_code == 204

    remaining = (await client.get("/groups", headers=auth_headers)).json()
    assert system_group["id"] not in {g["id"] for g in remaining}
    assert len(remaining) == len(groups) - 1


async def test_list_groups_include_hidden_true_shows_hidden(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)

    with_hidden = (await client.get("/groups?include_hidden=true", headers=auth_headers)).json()
    assert system_group["id"] in {g["id"] for g in with_hidden}
    assert len(with_hidden) == len(groups)


async def test_get_hidden_groups_lists_ids(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)

    resp = await client.get("/groups/hidden", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == [system_group["id"]]


async def test_hide_group_is_idempotent(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])

    first = await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)
    second = await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)
    assert first.status_code == 204
    assert second.status_code == 204

    resp = await client.get("/groups/hidden", headers=auth_headers)
    assert resp.json() == [system_group["id"]]


async def test_hide_custom_group_400(client, auth_headers):
    custom = (await client.post("/groups", json={"name": "Custom For Hide"}, headers=auth_headers)).json()
    resp = await client.post(f"/groups/{custom['id']}/hide", headers=auth_headers)
    assert resp.status_code == 400


async def test_hide_nonexistent_group_404(client, auth_headers):
    resp = await client.post(
        "/groups/00000000-0000-0000-0000-000000000000/hide", headers=auth_headers
    )
    assert resp.status_code == 404


async def test_unhide_group(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)

    resp = await client.delete(f"/groups/{system_group['id']}/hide", headers=auth_headers)
    assert resp.status_code == 204

    remaining = (await client.get("/groups", headers=auth_headers)).json()
    assert system_group["id"] in {g["id"] for g in remaining}


async def test_unhide_group_not_hidden_is_idempotent_204(client, auth_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    resp = await client.delete(f"/groups/{system_group['id']}/hide", headers=auth_headers)
    assert resp.status_code == 204


async def test_hidden_groups_are_scoped_per_user(client, auth_headers, second_user_headers):
    groups = (await client.get("/groups", headers=auth_headers)).json()
    system_group = next(g for g in groups if g["is_system"])
    await client.post(f"/groups/{system_group['id']}/hide", headers=auth_headers)

    other_view = (await client.get("/groups", headers=second_user_headers)).json()
    assert system_group["id"] in {g["id"] for g in other_view}
