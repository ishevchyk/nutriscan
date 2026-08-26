from typing import Sequence

from app.models.meal_ingredient import MealIngredient
from app.models.meal_portion import MealPortion

MACROS = ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt")


def calculate_meal_nutrition(
    ingredients: Sequence[MealIngredient],
    portions: Sequence[MealPortion],
) -> dict:
    """Per-meal (sum, no normalization), per-100g (sum then normalized by total
    grams), and per-portion (per-100g x portion.grams / 100) nutrition for a
    meal. Reads macros directly off each ingredient's own snapshot fields --
    no Product lookup involved, so this works identically for linked and
    unlinked ingredients, and is unaffected by a linked product later being
    edited, soft-deleted, or purged.
    """
    per_meal = {
        macro: sum(ingredient.grams / 100 * (getattr(ingredient, macro) or 0.0) for ingredient in ingredients)
        for macro in MACROS
    }
    total_grams = sum(ingredient.grams for ingredient in ingredients)
    per_100g = {
        macro: (per_meal[macro] / total_grams * 100 if total_grams > 0 else 0.0) for macro in MACROS
    }
    portions_out = {
        portion.id: {macro: per_100g[macro] * portion.grams / 100 for macro in MACROS} for portion in portions
    }
    return {"per_meal": per_meal, "per_100g": per_100g, "portions": portions_out}
