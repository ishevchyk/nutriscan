from dataclasses import dataclass, field
from typing import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meal_ingredient import MealIngredient
from app.nutrition import MACROS
from app.product_snapshot import load_product_nutrition


@dataclass
class ResolvedIngredient:
    """Read-only view of a meal ingredient with its effective values filled in.

    Deliberately NOT the ORM object: filling a followed ingredient's values
    onto a MealIngredient instance would mark it dirty and the next commit
    would persist product values into the row. Everything that calculates or
    serializes a meal's nutrition reads this instead."""

    id: UUID
    meal_id: UUID
    product_id: UUID | None
    name: str
    brand: str | None
    grams: float
    input_amount: float
    input_unit: str
    uses_own_values: bool
    calories: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    fiber: float | None = None
    sugar: float | None = None
    salt: float | None = None
    saturated_fat: float | None = None
    nutrients: dict[str, float] | None = field(default=None)

    @property
    def is_linked(self) -> bool:
        return self.product_id is not None

    def nutrition_snapshot(self) -> dict:
        """The per-100g values as stored on log rows."""
        return {
            "name": self.name,
            "brand": self.brand,
            **{macro: getattr(self, macro) for macro in MACROS},
            "nutrients": self.nutrients,
        }


def _own(ingredient: MealIngredient) -> ResolvedIngredient:
    return ResolvedIngredient(
        id=ingredient.id,
        meal_id=ingredient.meal_id,
        product_id=ingredient.product_id,
        name=ingredient.name,
        brand=ingredient.brand,
        grams=ingredient.grams,
        input_amount=float(ingredient.input_amount),
        input_unit=ingredient.input_unit,
        uses_own_values=ingredient.uses_own_values,
        **{macro: getattr(ingredient, macro) for macro in MACROS},
        nutrients=ingredient.nutrients,
    )


async def resolve_ingredients(
    db: AsyncSession, ingredients: Sequence[MealIngredient]
) -> list[ResolvedIngredient]:
    """Effective values per ingredient: the product's current ones for a linked
    ingredient that hasn't been edited, its own stored ones otherwise. One
    batched product lookup for the whole list."""
    followed = {i.product_id for i in ingredients if i.product_id is not None and not i.uses_own_values}
    products = await load_product_nutrition(db, followed)
    resolved: list[ResolvedIngredient] = []
    for ingredient in ingredients:
        view = _own(ingredient)
        values = products.get(ingredient.product_id) if ingredient.product_id in followed else None
        if values is not None:
            view.name = values["name"]
            view.brand = values["brand"]
            for macro in MACROS:
                setattr(view, macro, values[macro])
            view.nutrients = values["nutrients"]
        resolved.append(view)
    return resolved


def copy_values_to_row(ingredient: MealIngredient, view: ResolvedIngredient) -> None:
    """Materialize resolved values into the row and make it self-contained."""
    ingredient.name = view.name
    ingredient.brand = view.brand
    for macro in MACROS:
        setattr(ingredient, macro, getattr(view, macro))
    ingredient.nutrients = view.nutrients
    ingredient.uses_own_values = True
