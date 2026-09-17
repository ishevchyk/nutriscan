import uuid
from datetime import datetime, timezone

import pytest

from app.models.log_entry import LogEntry
from app.models.log_entry_meal_ingredient import LogEntryMealIngredient
from app.models.product import Product
from app.models.user import User
from app.tracking import calculate_log_entries_macros
from tests.conftest import TestSessionLocal

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _make_user(session) -> User:
    user = User(id=uuid.uuid4(), email=f"tracking-{uuid.uuid4()}@example.com", password_hash="x")
    session.add(user)
    await session.flush()
    return user


async def _make_product(session, user, **macros) -> Product:
    defaults = {"calories": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}
    defaults.update(macros)
    product = Product(id=uuid.uuid4(), user_id=user.id, name="Test Product", **defaults)
    session.add(product)
    await session.flush()
    return product


def _entry(user, source_type, **fields) -> LogEntry:
    return LogEntry(
        id=uuid.uuid4(),
        user_id=user.id,
        logged_at=datetime.now(timezone.utc),
        meal_slot="lunch",
        source_type=source_type,
        **fields,
    )


async def test_product_source_type_macros():
    async with TestSessionLocal() as session:
        user = await _make_user(session)
        product = await _make_product(session, user, calories=200, protein=10, fat=5, carbs=20)
        entry = _entry(user, "product", product_id=product.id, quantity_grams=50)
        session.add(entry)
        await session.flush()

        macros = (await calculate_log_entries_macros(session, [entry]))[entry.id]
        assert macros["calories"] == pytest.approx(100)  # 50/100 * 200
        assert macros["protein"] == pytest.approx(5)
        assert macros["fat"] == pytest.approx(2.5)
        assert macros["carbs"] == pytest.approx(10)


async def test_manual_source_type_macros_use_manual_fields_directly():
    async with TestSessionLocal() as session:
        user = await _make_user(session)
        entry = _entry(
            user, "manual", manual_calories=350, manual_protein=20, manual_fat=15, manual_carbs=40
        )
        session.add(entry)
        await session.flush()

        macros = (await calculate_log_entries_macros(session, [entry]))[entry.id]
        assert macros == {"calories": 350, "protein": 20, "fat": 15, "carbs": 40}


async def test_meal_source_type_macros_sum_over_snapshot_ingredients():
    async with TestSessionLocal() as session:
        user = await _make_user(session)
        cheese = await _make_product(session, user, calories=400, protein=25, fat=33, carbs=1)
        bread = await _make_product(session, user, calories=265, protein=9, fat=3, carbs=49)
        entry = _entry(user, "meal")
        session.add(entry)
        await session.flush()
        session.add_all(
            [
                LogEntryMealIngredient(log_entry_id=entry.id, product_id=cheese.id, grams=50),
                LogEntryMealIngredient(log_entry_id=entry.id, product_id=bread.id, grams=100),
            ]
        )
        await session.flush()

        macros = (await calculate_log_entries_macros(session, [entry]))[entry.id]
        expected_calories = 50 / 100 * 400 + 100 / 100 * 265
        expected_protein = 50 / 100 * 25 + 100 / 100 * 9
        assert macros["calories"] == pytest.approx(expected_calories)
        assert macros["protein"] == pytest.approx(expected_protein)


async def test_meal_entry_with_purged_product_contributes_zero_not_a_crash():
    async with TestSessionLocal() as session:
        user = await _make_user(session)
        entry = _entry(user, "meal")
        session.add(entry)
        await session.flush()
        # product_id null simulates a purged product (ondelete="SET NULL")
        session.add(LogEntryMealIngredient(log_entry_id=entry.id, product_id=None, grams=50))
        await session.flush()

        macros = (await calculate_log_entries_macros(session, [entry]))[entry.id]
        assert macros == {"calories": 0.0, "protein": 0.0, "fat": 0.0, "carbs": 0.0}
