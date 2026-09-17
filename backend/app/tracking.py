from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.log_entry import LogEntry
from app.models.log_entry_meal_ingredient import LogEntryMealIngredient
from app.models.product import Product

LOG_MACROS = ("calories", "protein", "fat", "carbs")


async def calculate_log_entries_macros(
    db: AsyncSession, entries: Sequence[LogEntry]
) -> dict[UUID, dict[str, float]]:
    """Computes {calories, protein, fat, carbs} for each entry per the three
    source_type formulas in README §6 ("Computing macros for a log entry").
    This is the one shared place that computation lives -- GET /log (per-entry)
    and GET /log/summary (daily totals) both call this instead of duplicating
    the math. DB lookups are batched across all entries up front rather than
    queried per-entry, since both callers pass a whole day's worth at once.
    """
    macros: dict[UUID, dict[str, float]] = {}

    product_entries = [e for e in entries if e.source_type == "product"]
    meal_entries = [e for e in entries if e.source_type == "meal"]
    manual_entries = [e for e in entries if e.source_type == "manual"]

    if product_entries:
        product_ids = {e.product_id for e in product_entries if e.product_id}
        products_by_id: dict[UUID, Product] = {}
        if product_ids:
            result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
            products_by_id = {p.id: p for p in result.scalars().all()}
        for entry in product_entries:
            product = products_by_id.get(entry.product_id)
            quantity = float(entry.quantity_grams or 0)
            macros[entry.id] = {
                macro: quantity / 100 * float(getattr(product, macro) or 0) if product else 0.0
                for macro in LOG_MACROS
            }

    if meal_entries:
        meal_entry_ids = [e.id for e in meal_entries]
        result = await db.execute(
            select(LogEntryMealIngredient).where(LogEntryMealIngredient.log_entry_id.in_(meal_entry_ids))
        )
        ingredient_rows = result.scalars().all()

        ingredient_product_ids = {row.product_id for row in ingredient_rows if row.product_id}
        products_by_id = {}
        if ingredient_product_ids:
            products_result = await db.execute(select(Product).where(Product.id.in_(ingredient_product_ids)))
            products_by_id = {p.id: p for p in products_result.scalars().all()}

        rows_by_entry: dict[UUID, list[LogEntryMealIngredient]] = {eid: [] for eid in meal_entry_ids}
        for row in ingredient_rows:
            rows_by_entry[row.log_entry_id].append(row)

        for entry in meal_entries:
            entry_macros = {macro: 0.0 for macro in LOG_MACROS}
            for row in rows_by_entry.get(entry.id, []):
                product = products_by_id.get(row.product_id)
                if not product:
                    continue
                grams = float(row.grams)
                for macro in LOG_MACROS:
                    entry_macros[macro] += grams / 100 * float(getattr(product, macro) or 0)
            macros[entry.id] = entry_macros

    for entry in manual_entries:
        macros[entry.id] = {
            "calories": float(entry.manual_calories or 0),
            "protein": float(entry.manual_protein or 0),
            "fat": float(entry.manual_fat or 0),
            "carbs": float(entry.manual_carbs or 0),
        }

    return macros


async def calculate_log_entry_macros(db: AsyncSession, entry: LogEntry) -> dict[str, float]:
    result = await calculate_log_entries_macros(db, [entry])
    return result[entry.id]
