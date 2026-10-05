import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _create(client, headers, **extra):
    resp = await client.post("/products", json={"name": "Oats", "calories": 370, **extra}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_nutrients_reference_list(client, auth_headers):
    resp = await client.get("/nutrients", headers=auth_headers)
    assert resp.status_code == 200
    by_code = {n["code"]: n for n in resp.json()}
    assert by_code["vitamin-c"]["unit"] == "mg"
    assert by_code["vitamin-c"]["nrv"] == 80
    assert by_code["monounsaturated-fat"]["parent_code"] == "fat"
    assert "Cache-Control" in resp.headers


async def test_create_with_saturated_fat_and_nutrients(client, auth_headers):
    product = await _create(client, auth_headers, saturated_fat=1.3, nutrients={"iron": 4.2, "vitamin-c": 0})
    assert product["saturated_fat"] == 1.3
    assert product["nutrients"] == {"iron": 4.2, "vitamin-c": 0}
    got = (await client.get(f"/products/{product['id']}", headers=auth_headers)).json()
    assert got["nutrients"] == {"iron": 4.2, "vitamin-c": 0}


async def test_patch_nutrients_upserts_and_null_deletes(client, auth_headers):
    product = await _create(client, auth_headers, nutrients={"iron": 4.2, "zinc": 3})
    resp = await client.patch(
        f"/products/{product['id']}", json={"nutrients": {"iron": 5, "zinc": None, "calcium": 50}}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["nutrients"] == {"iron": 5, "calcium": 50}


async def test_unknown_nutrient_code_rejected(client, auth_headers):
    resp = await client.post("/products", json={"name": "X", "nutrients": {"unobtainium": 1}}, headers=auth_headers)
    assert resp.status_code == 422


async def test_negative_nutrient_rejected(client, auth_headers):
    product = await _create(client, auth_headers)
    resp = await client.patch(f"/products/{product['id']}", json={"nutrients": {"iron": -1}}, headers=auth_headers)
    assert resp.status_code == 422


async def test_optional_facts_stay_null(client, auth_headers):
    product = await _create(client, auth_headers)
    assert product["fiber"] is None and product["saturated_fat"] is None
    assert product["nutrients"] == {} and product["portions"] == []


async def test_portions_crud_and_single_default(client, auth_headers):
    product = await _create(client, auth_headers)
    pid = product["id"]
    a = (await client.post(f"/products/{pid}/portions", json={"name": "1 bar", "grams": 52, "is_default": True}, headers=auth_headers)).json()
    b = (await client.post(f"/products/{pid}/portions", json={"name": "1 cup", "grams": 250, "is_default": True}, headers=auth_headers)).json()
    listed = (await client.get(f"/products/{pid}/portions", headers=auth_headers)).json()
    assert {p["name"]: p["is_default"] for p in listed} == {"1 bar": False, "1 cup": True}

    resp = await client.patch(f"/products/{pid}/portions/{a['id']}", json={"is_default": True}, headers=auth_headers)
    assert resp.json()["is_default"] is True
    listed = (await client.get(f"/products/{pid}/portions", headers=auth_headers)).json()
    assert sum(p["is_default"] for p in listed) == 1

    assert (await client.get(f"/products/{pid}", headers=auth_headers)).json()["portions"] != []
    assert (await client.delete(f"/products/{pid}/portions/{b['id']}", headers=auth_headers)).status_code == 204
    assert len((await client.get(f"/products/{pid}/portions", headers=auth_headers)).json()) == 1


async def test_portion_grams_must_be_positive(client, auth_headers):
    product = await _create(client, auth_headers)
    resp = await client.post(f"/products/{product['id']}/portions", json={"name": "x", "grams": 0}, headers=auth_headers)
    assert resp.status_code == 422


async def test_portions_are_owner_scoped(client, auth_headers, second_user_headers):
    product = await _create(client, auth_headers)
    resp = await client.post(f"/products/{product['id']}/portions", json={"name": "x", "grams": 10}, headers=second_user_headers)
    assert resp.status_code == 404


async def test_meal_snapshot_copies_nutrients_and_flags_partial(client, auth_headers):
    rich = await _create(client, auth_headers, saturated_fat=2, nutrients={"iron": 10})
    plain = await _create(client, auth_headers, calories=100)
    resp = await client.post(
        "/meals",
        json={
            "name": "Mix",
            "ingredients": [
                {"product_id": rich["id"], "input_amount": 100},
                {"product_id": plain["id"], "input_amount": 100},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    meal = resp.json()
    assert meal["ingredients"][0]["nutrients"] == {"iron": 10}
    assert meal["ingredients"][0]["saturated_fat"] == 2
    assert meal["ingredients"][1]["nutrients"] is None
    per_meal = meal["nutrition"]["per_meal"]
    assert per_meal["saturated_fat"] == 2
    assert per_meal["nutrients"] == {"iron": 10}
    assert per_meal["nutrients_partial"] == ["iron"]
    assert meal["nutrition"]["per_100g"]["nutrients"] == {"iron": 5}
