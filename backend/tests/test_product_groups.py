import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_product(client, headers, name="Test Product"):
    resp = await client.post("/products", json={"name": name}, headers=headers)
    return resp.json()


async def _create_group(client, headers, name):
    resp = await client.post("/groups", json={"name": name}, headers=headers)
    return resp.json()


async def _system_group_id(client, headers):
    groups = (await client.get("/groups", headers=headers)).json()
    return next(g for g in groups if g["is_system"])["id"]


async def test_assign_product_to_multiple_groups(client, auth_headers):
    product = await _create_product(client, auth_headers)
    g1 = await _create_group(client, auth_headers, "Group One")
    g2 = await _create_group(client, auth_headers, "Group Two")

    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [g1["id"], g2["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    names = {g["name"] for g in resp.json()}
    assert names == {"Group One", "Group Two"}


async def test_assign_product_reassign_is_noop(client, auth_headers):
    product = await _create_product(client, auth_headers)
    group = await _create_group(client, auth_headers, "Repeat Group")

    first = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )
    second = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert len(second.json()) == 1


async def test_assign_product_to_system_group_allowed(client, auth_headers):
    product = await _create_product(client, auth_headers)
    system_group_id = await _system_group_id(client, auth_headers)

    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [system_group_id]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == system_group_id


async def test_assign_product_invalid_group_id_400(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": ["00000000-0000-0000-0000-000000000000"]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_assign_product_someone_elses_custom_group_400(client, auth_headers, second_user_headers):
    product = await _create_product(client, auth_headers)
    foreign_group = await _create_group(client, second_user_headers, "Not Yours")

    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [foreign_group["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_assign_to_nonexistent_or_foreign_product_404(client, auth_headers, second_user_headers):
    product = await _create_product(client, second_user_headers)
    group = await _create_group(client, auth_headers, "My Group")

    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_assign_empty_group_ids_is_noop(client, auth_headers):
    product = await _create_product(client, auth_headers)
    resp = await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_remove_product_group_assignment(client, auth_headers):
    product = await _create_product(client, auth_headers)
    group = await _create_group(client, auth_headers, "Removable")
    await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )

    resp = await client.delete(
        f"/products/{product['id']}/groups/{group['id']}", headers=auth_headers
    )
    assert resp.status_code == 204

    fetched = await client.get(f"/products/{product['id']}", headers=auth_headers)
    assert fetched.json()["groups"] == []


async def test_remove_product_group_assignment_idempotent(client, auth_headers):
    product = await _create_product(client, auth_headers)
    group = await _create_group(client, auth_headers, "Idempotent Removal")

    first = await client.delete(
        f"/products/{product['id']}/groups/{group['id']}", headers=auth_headers
    )
    second = await client.delete(
        f"/products/{product['id']}/groups/{group['id']}", headers=auth_headers
    )
    assert first.status_code == 204
    assert second.status_code == 204


async def test_remove_group_from_foreign_product_404(client, auth_headers, second_user_headers):
    product = await _create_product(client, second_user_headers)
    group = await _create_group(client, auth_headers, "Whatever")

    resp = await client.delete(
        f"/products/{product['id']}/groups/{group['id']}", headers=auth_headers
    )
    assert resp.status_code == 404
