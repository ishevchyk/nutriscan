from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.recipe_ingredient import RecipeIngredient
from app.models.recipe_portion import RecipePortion
from app.models.user import User
from app.nutrition import MACROS, calculate_recipe_nutrition
from app.schemas.recipe import (
    RecipeCreate,
    RecipeDetailOut,
    RecipeIngredientIn,
    RecipeIngredientOut,
    RecipeIngredientPatch,
    RecipeListItemOut,
    RecipeUpdate,
)
from app.schemas.recipe_portion import RecipePortionCreate, RecipePortionOut, RecipePortionUpdate

router = APIRouter(prefix="/recipes", tags=["recipes"])


async def _get_owned_recipe(db: AsyncSession, recipe_id: UUID, current_user: User) -> Recipe:
    result = await db.execute(
        select(Recipe).where(
            Recipe.id == recipe_id, Recipe.user_id == current_user.id, Recipe.deleted_at.is_(None)
        )
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


async def _get_owned_portion(
    db: AsyncSession, recipe_id: UUID, portion_id: UUID, current_user: User
) -> RecipePortion:
    result = await db.execute(
        select(RecipePortion)
        .join(Recipe, Recipe.id == RecipePortion.recipe_id)
        .where(
            RecipePortion.id == portion_id,
            RecipePortion.recipe_id == recipe_id,
            Recipe.user_id == current_user.id,
            Recipe.deleted_at.is_(None),
        )
    )
    portion = result.scalar_one_or_none()
    if not portion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portion not found")
    return portion


async def _get_owned_ingredient(
    db: AsyncSession, recipe_id: UUID, ingredient_id: UUID, current_user: User
) -> RecipeIngredient:
    result = await db.execute(
        select(RecipeIngredient)
        .join(Recipe, Recipe.id == RecipeIngredient.recipe_id)
        .where(
            RecipeIngredient.id == ingredient_id,
            RecipeIngredient.recipe_id == recipe_id,
            Recipe.user_id == current_user.id,
            Recipe.deleted_at.is_(None),
        )
    )
    ingredient = result.scalar_one_or_none()
    if not ingredient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingredient not found")
    return ingredient


async def _attach_ingredients(db: AsyncSession, recipes: list[Recipe]) -> None:
    if not recipes:
        return
    recipe_ids = [r.id for r in recipes]
    result = await db.execute(select(RecipeIngredient).where(RecipeIngredient.recipe_id.in_(recipe_ids)))
    by_recipe: dict[UUID, list[RecipeIngredient]] = {rid: [] for rid in recipe_ids}
    for ingredient in result.scalars().all():
        by_recipe[ingredient.recipe_id].append(ingredient)
    for recipe in recipes:
        recipe.ingredients = by_recipe.get(recipe.id, [])


async def _attach_portions(db: AsyncSession, recipes: list[Recipe]) -> None:
    if not recipes:
        return
    recipe_ids = [r.id for r in recipes]
    result = await db.execute(select(RecipePortion).where(RecipePortion.recipe_id.in_(recipe_ids)))
    by_recipe: dict[UUID, list[RecipePortion]] = {rid: [] for rid in recipe_ids}
    for portion in result.scalars().all():
        by_recipe[portion.recipe_id].append(portion)
    for recipe in recipes:
        recipe.portions = by_recipe.get(recipe.id, [])


async def _build_recipe_detail(db: AsyncSession, recipe: Recipe) -> Recipe:
    """Attach ingredients/portions and compute nutrition fresh from current rows.
    Any write (create, replace-all, relink, manual edit, portion change) is
    reflected on the very next call to this — there's no cached/stale nutrition
    to invalidate."""
    await _attach_ingredients(db, [recipe])
    await _attach_portions(db, [recipe])
    nutrition = calculate_recipe_nutrition(recipe.ingredients, recipe.portions)
    recipe.nutrition = {"per_meal": nutrition["per_meal"], "per_100g": nutrition["per_100g"]}
    for portion in recipe.portions:
        portion.nutrition = nutrition["portions"][portion.id]
    return recipe


async def _resolve_ingredient_snapshot(
    db: AsyncSession, item: RecipeIngredientIn, current_user: User
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


@router.get("", response_model=list[RecipeListItemOut])
async def list_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Recipe)
        .where(Recipe.user_id == current_user.id, Recipe.deleted_at.is_(None))
        .order_by(Recipe.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/deleted", response_model=list[RecipeListItemOut])
async def list_deleted_recipes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Recipe).where(Recipe.user_id == current_user.id, Recipe.deleted_at.is_not(None))
    )
    return result.scalars().all()


@router.post("", response_model=RecipeDetailOut, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    body: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = Recipe(
        name=body.name,
        description=body.description,
        photo_url=body.photo_url,
        servings=body.servings,
        user_id=current_user.id,
    )
    db.add(recipe)
    await db.flush()
    for item in body.ingredients:
        snapshot = await _resolve_ingredient_snapshot(db, item, current_user)
        db.add(RecipeIngredient(recipe_id=recipe.id, grams=item.grams, **snapshot))
    await db.commit()
    await db.refresh(recipe)
    return await _build_recipe_detail(db, recipe)


@router.get("/{recipe_id}", response_model=RecipeDetailOut)
async def get_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = await _get_owned_recipe(db, recipe_id, current_user)
    return await _build_recipe_detail(db, recipe)


@router.patch("/{recipe_id}", response_model=RecipeDetailOut)
async def update_recipe(
    recipe_id: UUID,
    body: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = await _get_owned_recipe(db, recipe_id, current_user)
    updates = body.model_dump(exclude_unset=True, exclude={"ingredients"})
    for field, value in updates.items():
        setattr(recipe, field, value)

    if body.ingredients is not None:
        await db.execute(delete(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id))
        for item in body.ingredients:
            snapshot = await _resolve_ingredient_snapshot(db, item, current_user)
            db.add(RecipeIngredient(recipe_id=recipe.id, grams=item.grams, **snapshot))

    await db.commit()
    await db.refresh(recipe)
    return await _build_recipe_detail(db, recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = await _get_owned_recipe(db, recipe_id, current_user)
    recipe.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{recipe_id}/restore", response_model=RecipeDetailOut)
async def restore_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Recipe).where(
            Recipe.id == recipe_id, Recipe.user_id == current_user.id, Recipe.deleted_at.is_not(None)
        )
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found in recently deleted"
        )
    recipe.deleted_at = None
    await db.commit()
    await db.refresh(recipe)
    return await _build_recipe_detail(db, recipe)


@router.patch("/{recipe_id}/ingredients/{ingredient_id}", response_model=RecipeIngredientOut)
async def update_ingredient(
    recipe_id: UUID,
    ingredient_id: UUID,
    body: RecipeIngredientPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Relink (product_id set to a new product -> snapshot resyncs from it),
    unlink (product_id explicitly set to null -> snapshot preserved as-is), or
    edit the snapshot fields directly (no product_id key in the body at all)."""
    ingredient = await _get_owned_ingredient(db, recipe_id, ingredient_id, current_user)
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

    for field, value in updates.items():
        setattr(ingredient, field, value)

    await db.commit()
    await db.refresh(ingredient)
    return ingredient


@router.get("/{recipe_id}/portions", response_model=list[RecipePortionOut])
async def list_portions(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_recipe(db, recipe_id, current_user)
    result = await db.execute(select(RecipePortion).where(RecipePortion.recipe_id == recipe_id))
    return result.scalars().all()


@router.post("/{recipe_id}/portions", response_model=RecipePortionOut, status_code=status.HTTP_201_CREATED)
async def create_portion(
    recipe_id: UUID,
    body: RecipePortionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_recipe(db, recipe_id, current_user)
    if body.is_default:
        await db.execute(
            update(RecipePortion)
            .where(RecipePortion.recipe_id == recipe_id, RecipePortion.is_default.is_(True))
            .values(is_default=False)
        )
    portion = RecipePortion(recipe_id=recipe_id, name=body.name, grams=body.grams, is_default=body.is_default)
    db.add(portion)
    await db.commit()
    await db.refresh(portion)
    return portion


@router.patch("/{recipe_id}/portions/{portion_id}", response_model=RecipePortionOut)
async def update_portion(
    recipe_id: UUID,
    portion_id: UUID,
    body: RecipePortionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    portion = await _get_owned_portion(db, recipe_id, portion_id, current_user)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("is_default") is True:
        await db.execute(
            update(RecipePortion)
            .where(
                RecipePortion.recipe_id == recipe_id,
                RecipePortion.is_default.is_(True),
                RecipePortion.id != portion_id,
            )
            .values(is_default=False)
        )
    for field, value in updates.items():
        setattr(portion, field, value)
    await db.commit()
    await db.refresh(portion)
    return portion


@router.delete("/{recipe_id}/portions/{portion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portion(
    recipe_id: UUID,
    portion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # recipe_portions is hard-deleted (backend/CLAUDE.md's explicit exception to
    # the soft-delete rule) -- a real row delete, not deleted_at, no restore path.
    portion = await _get_owned_portion(db, recipe_id, portion_id, current_user)
    await db.delete(portion)
    await db.commit()
