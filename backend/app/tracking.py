from typing import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.log_entry import LogEntry
from app.models.log_entry_meal_ingredient import LogEntryMealIngredient

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

    # Values come from the snapshot frozen on the entry at log time, never from
    # the live product, so editing or purging a product can't change history.
    # A NULL snapshot contributes zero.
    for entry in product_entries:
        quantity = float(entry.quantity_grams or 0)
        nutrition = entry.nutrition or {}
        macros[entry.id] = {
            macro: quantity / 100 * float(nutrition.get(macro) or 0) for macro in LOG_MACROS
        }

    if meal_entries:
        meal_entry_ids = [e.id for e in meal_entries]
        result = await db.execute(
            select(LogEntryMealIngredient).where(LogEntryMealIngredient.log_entry_id.in_(meal_entry_ids))
        )
        rows_by_entry: dict[UUID, list[LogEntryMealIngredient]] = {eid: [] for eid in meal_entry_ids}
        for row in result.scalars().all():
            rows_by_entry[row.log_entry_id].append(row)

        for entry in meal_entries:
            entry_macros = {macro: 0.0 for macro in LOG_MACROS}
            for row in rows_by_entry.get(entry.id, []):
                nutrition = row.nutrition or {}
                grams = float(row.grams)
                for macro in LOG_MACROS:
                    entry_macros[macro] += grams / 100 * float(nutrition.get(macro) or 0)
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
