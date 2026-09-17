from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.product import Product
from app.models.product_unit_conversions import ProductUnitConversion
from app.models.meal import Meal
from app.models.meal_ingredient import MealIngredient
from app.models.meal_portion import MealPortion
from app.models.user import User
from app.nutrition import MACROS, calculate_meal_nutrition
from app.schemas.meal import (
    MealCreate,
    MealDetailOut,
    MealIngredientIn,
    MealIngredientOut,
    MealIngredientPatch,
    MealListItemOut,
    MealUpdate,
)
from app.schemas.meal_portion import MealPortionCreate, MealPortionOut, MealPortionUpdate

router = APIRouter(prefix="/meals", tags=["meals"])


async def _get_owned_meal(db: AsyncSession, meal_id: UUID, current_user: User) -> Meal:
    result = await db.execute(
        select(Meal).where(
            Meal.id == meal_id, Meal.user_id == current_user.id, Meal.deleted_at.is_(None)
        )
    )
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")
    return meal


async def _get_owned_portion(
    db: AsyncSession, meal_id: UUID, portion_id: UUID, current_user: User
) -> MealPortion:
    result = await db.execute(
        select(MealPortion)
        .join(Meal, Meal.id == MealPortion.meal_id)
        .where(
            MealPortion.id == portion_id,
            MealPortion.meal_id == meal_id,
            Meal.user_id == current_user.id,
            Meal.deleted_at.is_(None),
        )
    )
    portion = result.scalar_one_or_none()
    if not portion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portion not found")
    return portion


async def _get_owned_ingredient(
    db: AsyncSession, meal_id: UUID, ingredient_id: UUID, current_user: User
) -> MealIngredient:
    result = await db.execute(
        select(MealIngredient)
        .join(Meal, Meal.id == MealIngredient.meal_id)
        .where(
            MealIngredient.id == ingredient_id,
            MealIngredient.meal_id == meal_id,
            Meal.user_id == current_user.id,
            Meal.deleted_at.is_(None),
        )
    )
    ingredient = result.scalar_one_or_none()
    if not ingredient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")
    return ingredient


async def _attach_ingredients(db: AsyncSession, meals: list[Meal]) -> None:
    if not meals:
        return
    meal_ids = [m.id for m in meals]
    result = await db.execute(select(MealIngredient).where(MealIngredient.meal_id.in_(meal_ids)))
    by_meal: dict[UUID, list[MealIngredient]] = {mid: [] for mid in meal_ids}
    for ingredient in result.scalars().all():
        by_meal[ingredient.meal_id].append(ingredient)
    for meal in meals:
        meal.ingredients = by_meal.get(meal.id, [])


async def _attach_portions(db: AsyncSession, meals: list[Meal]) -> None:
    if not meals:
        return
    meal_ids = [m.id for m in meals]
    result = await db.execute(select(MealPortion).where(MealPortion.meal_id.in_(meal_ids)))
    by_meal: dict[UUID, list[MealPortion]] = {mid: [] for mid in meal_ids}
    for portion in result.scalars().all():
        by_meal[portion.meal_id].append(portion)
    for meal in meals:
        meal.portions = by_meal.get(meal.id, [])


async def _build_meal_detail(db: AsyncSession, meal: Meal) -> Meal:
    """Attach ingredients/portions and compute nutrition fresh from current rows.
    Any write (create, replace-all, relink, manual edit, portion change) is
    reflected on the very next call to this — there's no cached/stale nutrition
    to invalidate."""
    await _attach_ingredients(db, [meal])
    await _attach_portions(db, [meal])
    nutrition = calculate_meal_nutrition(meal.ingredients, meal.portions, meal.cooked_weight_grams)
    meal.nutrition = {"per_meal": nutrition["per_meal"], "per_100g": nutrition["per_100g"]}
    for portion in meal.portions:
        portion.nutrition = nutrition["portions"][portion.id]
    return meal


async def _resolve_ingredient_snapshot(
    db: AsyncSession, item: MealIngredientIn, current_user: User
) -> dict:
    """Linked ingredients (product_id set) always take their snapshot from the
    product's current values -- any name/brand/macro fields also sent on `item`
    are ignored, product data is authoritative. Unlinked ingredients use the
    submitted fields directly (name is guaranteed present by the schema)."""
    if item.product_id is not None:
        result = await db.execute(
            select(Product).where(
                Product.id == item.product_id,
                Product.user_id == current_user.id,
                Product.deleted_at.is_(None),
            )
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id is invalid")
        return {
            "product_id": product.id,
            "name": product.name,
            "brand": product.brand,
            **{macro: getattr(product, macro) for macro in MACROS},
        }
    return {
        "product_id": None,
        "name": item.name,
        "brand": item.brand,
        **{macro: getattr(item, macro) for macro in MACROS},
    }


async def _resolve_ingredient_grams(
    db: AsyncSession,
    *,
    product_id: UUID | None,
    input_amount: float,
    input_unit: str,
    grams: float | None,
) -> float:
    """input_unit == 'g' -> grams is input_amount as-is. A household unit on a
    linked ingredient looks up product_unit_conversions (ingredient-specific --
    a tbsp of sugar has a different grams_per_unit than a tbsp of oil). An
    unlinked ingredient has no product to key a saved conversion off of, so a
    household unit there requires grams supplied directly in the same request
    instead of persisting a one-off conversion for a rare case."""
    if input_unit == "g":
        return input_amount

    if product_id is not None:
        result = await db.execute(
            select(ProductUnitConversion).where(
                ProductUnitConversion.product_id == product_id,
                ProductUnitConversion.unit == input_unit,
            )
        )
        conversion = result.scalar_one_or_none()
        if conversion is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "unit_conversion_missing",
                    "message": f"No saved conversion for unit '{input_unit}' on this product",
                },
            )
        return input_amount * float(conversion.grams_per_unit)

    if grams is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "grams_required",
                "message": "grams is required for an unlinked ingredient using a non-gram unit",
            },
        )
    return grams


@router.get("", response_model=list[MealListItemOut])
async def list_meals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meal)
        .where(Meal.user_id == current_user.id, Meal.deleted_at.is_(None))
        .order_by(Meal.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/deleted", response_model=list[MealListItemOut])
async def list_deleted_meals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meal).where(Meal.user_id == current_user.id, Meal.deleted_at.is_not(None))
    )
    return result.scalars().all()


@router.post("", response_model=MealDetailOut, status_code=status.HTTP_201_CREATED)
async def create_meal(
    body: MealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = Meal(
        name=body.name,
        description=body.description,
        photo_url=body.photo_url,
        servings=body.servings,
        cooked_weight_grams=body.cooked_weight_grams,
        user_id=current_user.id,
    )
    db.add(meal)
    await db.flush()
    for item in body.ingredients:
        snapshot = await _resolve_ingredient_snapshot(db, item, current_user)
        grams = await _resolve_ingredient_grams(
            db,
            product_id=snapshot["product_id"],
            input_amount=item.input_amount,
            input_unit=item.input_unit,
            grams=item.grams,
        )
        db.add(
            MealIngredient(
                meal_id=meal.id,
                grams=grams,
                input_amount=item.input_amount,
                input_unit=item.input_unit,
                **snapshot,
            )
        )
    await db.commit()
    await db.refresh(meal)
    return await _build_meal_detail(db, meal)


@router.get("/{meal_id}", response_model=MealDetailOut)
async def get_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = await _get_owned_meal(db, meal_id, current_user)
    return await _build_meal_detail(db, meal)


@router.patch("/{meal_id}", response_model=MealDetailOut)
async def update_meal(
    meal_id: UUID,
    body: MealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = await _get_owned_meal(db, meal_id, current_user)
    updates = body.model_dump(exclude_unset=True, exclude={"ingredients"})
    for field, value in updates.items():
        setattr(meal, field, value)

    if body.ingredients is not None:
        await db.execute(delete(MealIngredient).where(MealIngredient.meal_id == meal.id))
        for item in body.ingredients:
            snapshot = await _resolve_ingredient_snapshot(db, item, current_user)
            grams = await _resolve_ingredient_grams(
                db,
                product_id=snapshot["product_id"],
                input_amount=item.input_amount,
                input_unit=item.input_unit,
                grams=item.grams,
            )
            db.add(
                MealIngredient(
                    meal_id=meal.id,
                    grams=grams,
                    input_amount=item.input_amount,
                    input_unit=item.input_unit,
                    **snapshot,
                )
            )

    await db.commit()
    await db.refresh(meal)
    return await _build_meal_detail(db, meal)


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = await _get_owned_meal(db, meal_id, current_user)
    meal.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{meal_id}/restore", response_model=MealDetailOut)
async def restore_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meal).where(
            Meal.id == meal_id, Meal.user_id == current_user.id, Meal.deleted_at.is_not(None)
        )
    )
    meal = result.scalar_one_or_none()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found in recently deleted"
        )
    meal.deleted_at = None
    await db.commit()
    await db.refresh(meal)
    return await _build_meal_detail(db, meal)


@router.post("/{meal_id}/ingredients", response_model=MealIngredientOut, status_code=status.HTTP_201_CREATED)
async def add_ingredient(
    meal_id: UUID,
    body: MealIngredientIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meal = await _get_owned_meal(db, meal_id, current_user)
    snapshot = await _resolve_ingredient_snapshot(db, body, current_user)
    grams = await _resolve_ingredient_grams(
        db,
        product_id=snapshot["product_id"],
        input_amount=body.input_amount,
        input_unit=body.input_unit,
        grams=body.grams,
    )
    ingredient = MealIngredient(
        meal_id=meal.id,
        grams=grams,
        input_amount=body.input_amount,
        input_unit=body.input_unit,
        **snapshot,
    )
    db.add(ingredient)
    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.patch("/{meal_id}/ingredients/{ingredient_id}", response_model=MealIngredientOut)
async def update_ingredient(
    meal_id: UUID,
    ingredient_id: UUID,
    body: MealIngredientPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Relink (product_id set to a new product -> snapshot resyncs from it),
    unlink (product_id explicitly set to null -> snapshot preserved as-is), or
    edit the snapshot fields directly (no product_id key in the body at all).
    Sending input_amount and/or input_unit re-derives grams from whichever of
    the two didn't change (via _resolve_ingredient_grams); grams sent alone,
    with neither of those keys present, is still a direct manual override."""
    ingredient = await _get_owned_ingredient(db, meal_id, ingredient_id, current_user)
    updates = body.model_dump(exclude_unset=True)

    if "product_id" in updates:
        product_id = updates.pop("product_id")
        if product_id is not None:
            result = await db.execute(
                select(Product).where(
                    Product.id == product_id,
                    Product.user_id == current_user.id,
                    Product.deleted_at.is_(None),
                )
            )
            product = result.scalar_one_or_none()
            if not product:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="product_id is invalid")
            ingredient.product_id = product.id
            ingredient.name = product.name
            ingredient.brand = product.brand
            for macro in MACROS:
                setattr(ingredient, macro, getattr(product, macro))
            for key in ("name", "brand", *MACROS):
                updates.pop(key, None)
        else:
            ingredient.product_id = None

    if "input_amount" in updates or "input_unit" in updates:
        input_amount = updates.pop("input_amount", ingredient.input_amount)
        input_unit = updates.pop("input_unit", ingredient.input_unit)
        ingredient.grams = await _resolve_ingredient_grams(
            db,
            product_id=ingredient.product_id,
            input_amount=input_amount,
            input_unit=input_unit,
            grams=updates.pop("grams", None),
        )
        ingredient.input_amount = input_amount
        ingredient.input_unit = input_unit

    for field, value in updates.items():
        setattr(ingredient, field, value)

    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.get("/{meal_id}/portions", response_model=list[MealPortionOut])
async def list_portions(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_meal(db, meal_id, current_user)
    result = await db.execute(select(MealPortion).where(MealPortion.meal_id == meal_id))
    return result.scalars().all()


@router.post("/{meal_id}/portions", response_model=MealPortionOut, status_code=status.HTTP_201_CREATED)
async def create_portion(
    meal_id: UUID,
    body: MealPortionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_meal(db, meal_id, current_user)
    if body.is_default:
        await db.execute(
            update(MealPortion)
            .where(MealPortion.meal_id == meal_id, MealPortion.is_default.is_(True))
            .values(is_default=False)
        )
    portion = MealPortion(meal_id=meal_id, name=body.name, grams=body.grams, is_default=body.is_default)
    db.add(portion)
    await db.commit()
    await db.refresh(portion)
    return portion


@router.patch("/{meal_id}/portions/{portion_id}", response_model=MealPortionOut)
async def update_portion(
    meal_id: UUID,
    portion_id: UUID,
    body: MealPortionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portion = await _get_owned_portion(db, meal_id, portion_id, current_user)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("is_default") is True:
        await db.execute(
            update(MealPortion)
            .where(
                MealPortion.meal_id == meal_id,
                MealPortion.is_default.is_(True),
                MealPortion.id != portion_id,
            )
            .values(is_default=False)
        )
    for field, value in updates.items():
        setattr(portion, field, value)
    await db.commit()
    await db.refresh(portion)
    return portion


@router.delete("/{meal_id}/portions/{portion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portion(
    meal_id: UUID,
    portion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # meal_portions is hard-deleted (backend/CLAUDE.md's explicit exception to
    # the soft-delete rule) -- a real row delete, not deleted_at, no restore path.
    portion = await _get_owned_portion(db, meal_id, portion_id, current_user)
    await db.delete(portion)
    await db.commit()
