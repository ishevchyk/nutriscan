import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create_product(client, headers, name="Test Product"):
    resp = await client.post("/products", json={"name": name}, headers=headers)
    return resp.json()


async def _create_group(client, headers, name):
    resp = await client.post("/groups", json={"name": name}, headers=headers)
    return resp.json()


async def test_create_product_groups_empty_by_default(client, auth_headers):
    product = await _create_product(client, auth_headers)
    assert product["groups"] == []


async def test_get_products_group_id_filter(client, auth_headers):
    tagged = await _create_product(client, auth_headers, "Tagged")
    untagged = await _create_product(client, auth_headers, "Untagged")
    group = await _create_group(client, auth_headers, "Filter Group")
    await client.post(
        f"/products/{tagged['id']}/groups",
        json={"group_ids": [group["id"]]},
        headers=auth_headers,
    )

    resp = await client.get(f"/products?group_id={group['id']}", headers=auth_headers)
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()}
    assert ids == {tagged["id"]}
    assert untagged["id"] not in ids


async def test_get_products_group_id_filter_no_matches_empty_list(client, auth_headers):
    await _create_product(client, auth_headers)
    group = await _create_group(client, auth_headers, "Unused Group")

    resp = await client.get(f"/products?group_id={group['id']}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_product_includes_groups(client, auth_headers):
    product = await _create_product(client, auth_headers)
    g1 = await _create_group(client, auth_headers, "Detail Group One")
    g2 = await _create_group(client, auth_headers, "Detail Group Two")
    await client.post(
        f"/products/{product['id']}/groups",
        json={"group_ids": [g1["id"], g2["id"]]},
        headers=auth_headers,
    )

    resp = await client.get(f"/products/{product['id']}", headers=auth_headers)
    assert resp.status_code == 200
    names = {g["name"] for g in resp.json()["groups"]}
    assert names == {"Detail Group One", "Detail Group Two"}


async def test_get_products_list_includes_groups_per_product(client, auth_headers):
    p1 = await _create_product(client, auth_headers, "List Product One")
    p2 = await _create_product(client, auth_headers, "List Product Two")
    group = await _create_group(client, auth_headers, "List Group")
    await client.post(
        f"/products/{p1['id']}/groups", json={"group_ids": [group["id"]]}, headers=auth_headers
    )

    resp = await client.get("/products", headers=auth_headers)
    assert resp.status_code == 200
    by_id = {p["id"]: p["groups"] for p in resp.json()}
    assert [g["id"] for g in by_id[p1["id"]]] == [group["id"]]
    assert by_id[p2["id"]] == []
