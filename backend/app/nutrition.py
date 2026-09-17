from typing import Sequence

from app.models.meal_ingredient import MealIngredient
from app.models.meal_portion import MealPortion

MACROS = ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt")


def compute_reference_grams(ingredients: Sequence[MealIngredient], cooked_weight_grams: float | None) -> float:
    """The weight portion/per-100g math should be measured against: a meal's
    recorded cooked_weight_grams when set (since that's the weight the dish is
    actually measured/logged by after cooking -- water evaporation/absorption
    means it's rarely the same as the raw ingredient total), otherwise the raw
    ingredient total. Shared by calculate_meal_nutrition below and by
    app/routers/log.py's portion-scaling when logging a meal, so a portion
    always means the same weight whether you're viewing the meal or logging it."""
    total_grams = sum(ingredient.grams for ingredient in ingredients)
    return cooked_weight_grams if cooked_weight_grams is not None else total_grams


def calculate_meal_nutrition(
    ingredients: Sequence[MealIngredient],
    portions: Sequence[MealPortion],
    cooked_weight_grams: float | None = None,
) -> dict:
    """Per-meal (sum, no normalization), per-100g (sum then normalized by a
    reference weight), and per-portion (per-100g x portion.grams / 100)
    nutrition for a meal. Reads macros directly off each ingredient's own
    snapshot fields -- no Product lookup involved, so this works identically
    for linked and unlinked ingredients, and is unaffected by a linked
    product later being edited, soft-deleted, or purged.

    per_meal is always the sum over raw ingredient grams -- cooking doesn't
    change total calories/protein/etc., only water content. per_100g (and
    therefore portions, which derive from it) normalizes against
    compute_reference_grams (cooked_weight_grams when set, else the raw
    ingredient total).
    """
    per_meal = {
        macro: sum(ingredient.grams / 100 * (getattr(ingredient, macro) or 0.0) for ingredient in ingredients)
        for macro in MACROS
    }
    reference_grams = compute_reference_grams(ingredients, cooked_weight_grams)
    per_100g = {
        macro: (per_meal[macro] / reference_grams * 100 if reference_grams > 0 else 0.0) for macro in MACROS
    }
    portions_out = {
        portion.id: {macro: per_100g[macro] * portion.grams / 100 for macro in MACROS} for portion in portions
    }
    return {"per_meal": per_meal, "per_100g": per_100g, "portions": portions_out}
