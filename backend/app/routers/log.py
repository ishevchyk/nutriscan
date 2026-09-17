from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.log_entry import LogEntry
from app.models.log_entry_meal_ingredient import LogEntryMealIngredient
from app.models.meal import Meal
from app.models.meal_ingredient import MealIngredient
from app.models.meal_portion import MealPortion
from app.models.product import Product
from app.models.user import User
from app.models.user_goal import UserGoal
from app.schemas.log import (
    MEAL_SLOTS,
    IngredientOverride,
    LogEntryCreate,
    LogEntryMealCreate,
    LogEntryMealIngredientOut,
    LogEntryOut,
    LogEntryProductCreate,
    LogEntryUpdate,
    LoggedDaysOut,
    LogMacrosOut,
    LogSummaryOut,
)
from app.nutrition import compute_reference_grams
from app.tracking import LOG_MACROS, calculate_log_entries_macros

router = APIRouter(prefix="/log", tags=["log"])


def _day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    # TODO(Phase 5): user_settings.timezone doesn't exist yet, so "day" is
    # computed in UTC for now. Once user_settings lands, swap this for the
    # user's own timezone -- the `date` query param on GET /log and
    # GET /log/summary stays the same, only this boundary math changes.
    start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


async def _get_owned_log_entry(db: AsyncSession, entry_id: UUID, current_user: User) -> LogEntry:
    result = await db.execute(
        select(LogEntry).where(LogEntry.id == entry_id, LogEntry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    return entry


async def _get_owned_product(db: AsyncSession, product_id: UUID, current_user: User) -> Product:
    result = await db.execute(
        select(Product).where(
            Product.id == product_id, Product.user_id == current_user.id, Product.deleted_at.is_(None)
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id is invalid")
    return product


async def _get_owned_meal_with_ingredients(
    db: AsyncSession, meal_id: UUID, current_user: User
) -> tuple[Meal, list[MealIngredient]]:
    result = await db.execute(
        select(Meal).where(Meal.id == meal_id, Meal.user_id == current_user.id, Meal.deleted_at.is_(None))
    )
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="meal_id is invalid")
    ingredients_result = await db.execute(select(MealIngredient).where(MealIngredient.meal_id == meal_id))
    return meal, list(ingredients_result.scalars().all())


async def _build_meal_snapshot(
    db: AsyncSession,
    meal: Meal,
    ingredients: list[MealIngredient],
    portion_id: UUID | None,
    ingredient_overrides: list[IngredientOverride] | None,
    quantity_grams: float | None,
) -> tuple[list[dict], float]:
    """Returns ([{product_id, grams}, ...], logged_grams).

    The snapshot list is persisted as log_entry_meal_ingredients and is a
    raw-ingredient-equivalent breakdown -- it exists only so macros can be
    computed per ingredient (README §6). It is NOT the weight of the dish
    that was logged: once the meal has a cooked_weight_grams, summing it
    diverges from that on purpose (see nutrition.py's compute_reference_grams
    docstring). logged_grams is that separate, human-meaningful weight,
    stored on log_entries.quantity_grams -- explicit quantity_grams from the
    request wins, otherwise it's derived: portion.grams for a portion (the
    same weight nutrition.py's per-portion figures assume), the sum of the
    given overrides for a raw ingredient_overrides edit (nothing else to go
    on), or the meal's reference weight (cooked_weight_grams if set, else raw
    total) for an unscaled whole-meal log.

    Every one of the meal's ingredients must be linked (product_id set): that
    table's product_id is how the macro calc looks up per-100g macros (README
    §6), and there's no snapshot field on it to fall back to for an unlinked
    ingredient, so a meal with any unlinked ingredient can't be logged yet.

    ingredient_overrides, when given, fully replaces the portion-scaled
    snapshot rather than layering on top of it (CLAUDE.md: "use those grams
    directly per ingredient instead"). No portion_id and no overrides logs the
    meal exactly as written (grams unscaled).
    """
    linked_product_ids = {ing.product_id for ing in ingredients if ing.product_id is not None}
    if len(linked_product_ids) != len(ingredients):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "meal_has_unlinked_ingredients",
                "message": "This meal has ingredients not linked to a saved product and can't be logged yet",
            },
        )

    if ingredient_overrides is not None:
        invalid = {o.product_id for o in ingredient_overrides} - linked_product_ids
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ingredient_overrides reference products not in this meal",
            )
        snapshot = [{"product_id": o.product_id, "grams": o.grams} for o in ingredient_overrides]
        logged_grams = quantity_grams if quantity_grams is not None else sum(o.grams for o in ingredient_overrides)
        return snapshot, logged_grams

    if portion_id is not None:
        portion_result = await db.execute(
            select(MealPortion).where(MealPortion.id == portion_id, MealPortion.meal_id == meal.id)
        )
        portion = portion_result.scalar_one_or_none()
        if not portion:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="portion_id is invalid")
        # Same reference weight nutrition.py scales portions against (cooked_weight_grams
        # when set, else raw ingredient total) -- otherwise a portion would mean a
        # different weight when logged than what the meal detail screen shows for it.
        reference_grams = compute_reference_grams(ingredients, meal.cooked_weight_grams)
        scale = (portion.grams / reference_grams) if reference_grams > 0 else 0.0
        snapshot = [{"product_id": ing.product_id, "grams": ing.grams * scale} for ing in ingredients]
        logged_grams = quantity_grams if quantity_grams is not None else portion.grams
        return snapshot, logged_grams

    snapshot = [{"product_id": ing.product_id, "grams": ing.grams} for ing in ingredients]
    logged_grams = (
        quantity_grams if quantity_grams is not None else compute_reference_grams(ingredients, meal.cooked_weight_grams)
    )
    return snapshot, logged_grams


async def _attach_meal_ingredients(
    db: AsyncSession, entries: list[LogEntry]
) -> dict[UUID, list[LogEntryMealIngredient]]:
    meal_entry_ids = [e.id for e in entries if e.source_type == "meal"]
    if not meal_entry_ids:
        return {}
    result = await db.execute(
        select(LogEntryMealIngredient).where(LogEntryMealIngredient.log_entry_id.in_(meal_entry_ids))
    )
    by_entry: dict[UUID, list[LogEntryMealIngredient]] = {eid: [] for eid in meal_entry_ids}
    for row in result.scalars().all():
        by_entry[row.log_entry_id].append(row)
    return by_entry


def _serialize_entry(
    entry: LogEntry, macros: dict[str, float], meal_ingredients: list[LogEntryMealIngredient] | None
) -> LogEntryOut:
    return LogEntryOut(
        id=entry.id,
        logged_at=entry.logged_at,
        meal_slot=entry.meal_slot,
        source_type=entry.source_type,
        product_id=entry.product_id,
        quantity_grams=entry.quantity_grams,
        meal_id=entry.meal_id,
        portion_id=entry.portion_id,
        manual_calories=entry.manual_calories,
        manual_protein=entry.manual_protein,
        manual_fat=entry.manual_fat,
        manual_carbs=entry.manual_carbs,
        created_at=entry.created_at,
        macros=LogMacrosOut(**macros),
        meal_ingredients=(
            [LogEntryMealIngredientOut(product_id=r.product_id, grams=r.grams) for r in meal_ingredients]
            if meal_ingredients is not None
            else None
        ),
    )


async def _serialize_entries(db: AsyncSession, entries: list[LogEntry]) -> list[LogEntryOut]:
    macros_by_id = await calculate_log_entries_macros(db, entries)
    ingredients_by_entry = await _attach_meal_ingredients(db, entries)
    return [
        _serialize_entry(
            entry,
            macros_by_id[entry.id],
            ingredients_by_entry.get(entry.id) if entry.source_type == "meal" else None,
        )
        for entry in entries
    ]


@router.get("", response_model=dict[str, list[LogEntryOut]])
async def list_log_entries(
    date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _day_bounds_utc(date)
    result = await db.execute(
        select(LogEntry)
        .where(
            LogEntry.user_id == current_user.id,
            LogEntry.logged_at >= start,
            LogEntry.logged_at < end,
        )
        .order_by(LogEntry.logged_at)
    )
    entries = list(result.scalars().all())
    serialized = await _serialize_entries(db, entries)

    grouped: dict[str, list[LogEntryOut]] = {slot: [] for slot in MEAL_SLOTS}
    for entry, out in zip(entries, serialized):
        grouped[entry.meal_slot].append(out)
    return grouped


@router.post("", response_model=LogEntryOut, status_code=status.HTTP_201_CREATED)
async def create_log_entry(
    body: LogEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if isinstance(body, LogEntryProductCreate):
        await _get_owned_product(db, body.product_id, current_user)
        entry = LogEntry(
            user_id=current_user.id,
            logged_at=body.logged_at,
            meal_slot=body.meal_slot,
            source_type="product",
            product_id=body.product_id,
            quantity_grams=body.quantity_grams,
        )
        db.add(entry)
        await db.flush()

    elif isinstance(body, LogEntryMealCreate):
        meal, ingredients = await _get_owned_meal_with_ingredients(db, body.meal_id, current_user)
        snapshot, logged_grams = await _build_meal_snapshot(
            db, meal, ingredients, body.portion_id, body.ingredient_overrides, body.quantity_grams
        )
        entry = LogEntry(
            user_id=current_user.id,
            logged_at=body.logged_at,
            meal_slot=body.meal_slot,
            source_type="meal",
            meal_id=body.meal_id,
            portion_id=body.portion_id,
            quantity_grams=logged_grams,
        )
        db.add(entry)
        await db.flush()
        for row in snapshot:
            db.add(LogEntryMealIngredient(log_entry_id=entry.id, **row))

    else:
        entry = LogEntry(
            user_id=current_user.id,
            logged_at=body.logged_at,
            meal_slot=body.meal_slot,
            source_type="manual",
            manual_calories=body.manual_calories,
            manual_protein=body.manual_protein,
            manual_fat=body.manual_fat,
            manual_carbs=body.manual_carbs,
        )
        db.add(entry)
        await db.flush()

    await db.commit()
    await db.refresh(entry)
    serialized = await _serialize_entries(db, [entry])
    return serialized[0]


@router.patch("/{entry_id}", response_model=LogEntryOut)
async def update_log_entry(
    entry_id: UUID,
    body: LogEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """source_type is never editable here (CLAUDE.md). Which fields are
    allowed depends on the entry's existing source_type -- sending a field
    that doesn't match (e.g. quantity_grams on a 'manual' entry) is a 422."""
    entry = await _get_owned_log_entry(db, entry_id, current_user)
    updates = body.model_dump(exclude_unset=True)

    if "quantity_grams" in updates and entry.source_type not in ("product", "meal"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="quantity_grams can only be edited on a 'product' or 'meal' entry",
        )
    manual_fields = {"manual_calories", "manual_protein", "manual_fat", "manual_carbs"}
    if (updates.keys() & manual_fields) and entry.source_type != "manual":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="manual_* fields can only be edited on a 'manual' entry",
        )
    if "ingredient_overrides" in updates and entry.source_type != "meal":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ingredient_overrides can only be edited on a 'meal' entry",
        )

    if "ingredient_overrides" in updates:
        overrides = updates.pop("ingredient_overrides")
        existing_result = await db.execute(
            select(LogEntryMealIngredient).where(LogEntryMealIngredient.log_entry_id == entry.id)
        )
        by_product = {row.product_id: row for row in existing_result.scalars().all()}
        for override in overrides:
            row = by_product.get(override["product_id"])
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ingredient_overrides reference a product not in this log entry",
                )
            row.grams = override["grams"]

    for field, value in updates.items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)
    serialized = await _serialize_entries(db, [entry])
    return serialized[0]


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # log_entries has no deleted_at column (backend/CLAUDE.md's explicit
    # exception to the soft-delete rule) -- a real row delete, no restore path.
    # log_entry_meal_ingredients rows cascade via ondelete="CASCADE".
    entry = await _get_owned_log_entry(db, entry_id, current_user)
    await db.delete(entry)
    await db.commit()


@router.get("/summary", response_model=LogSummaryOut)
async def get_log_summary(
    date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _day_bounds_utc(date)
    result = await db.execute(
        select(LogEntry).where(
            LogEntry.user_id == current_user.id,
            LogEntry.logged_at >= start,
            LogEntry.logged_at < end,
        )
    )
    entries = list(result.scalars().all())
    macros_by_id = await calculate_log_entries_macros(db, entries)
    totals = {macro: sum(m[macro] for m in macros_by_id.values()) for macro in LOG_MACROS}

    goal_result = await db.execute(select(UserGoal).where(UserGoal.user_id == current_user.id))
    goal = goal_result.scalar_one_or_none()
    goals = (
        LogMacrosOut(
            calories=goal.calories_goal or 0,
            protein=goal.protein_goal or 0,
            fat=goal.fat_goal or 0,
            carbs=goal.carbs_goal or 0,
        )
        if goal
        else None
    )

    return LogSummaryOut(date=date, totals=LogMacrosOut(**totals), goals=goals)


@router.get("/logged-days", response_model=LoggedDaysOut)
async def get_logged_days(
    year: int = Query(..., ge=1),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    next_month, next_year = (1, year + 1) if month == 12 else (month + 1, year)
    end = datetime(next_year, next_month, 1, tzinfo=timezone.utc)

    result = await db.execute(
        select(LogEntry.logged_at).where(
            LogEntry.user_id == current_user.id,
            LogEntry.logged_at >= start,
            LogEntry.logged_at < end,
        )
    )
    days = sorted({logged_at.day for logged_at in result.scalars().all()})
    return LoggedDaysOut(days=days)
