import uuid

import pytest

from app.models.recipe_ingredient import RecipeIngredient
from app.models.recipe_portion import RecipePortion
from app.nutrition import calculate_recipe_nutrition


def _ingredient(grams, **macros):
    defaults = {"calories": 0, "protein": 0, "fat": 0, "carbs": 0, "fiber": 0, "sugar": 0, "salt": 0}
    defaults.update(macros)
    return RecipeIngredient(id=uuid.uuid4(), grams=grams, name="test", **defaults)


def _portion(grams):
    return RecipePortion(id=uuid.uuid4(), name="portion", grams=grams, is_default=False)


def test_zero_ingredients_returns_zeros_no_division_error():
    result = calculate_recipe_nutrition([], [])
    for macro in ("calories", "protein", "fat", "carbs", "fiber", "sugar", "salt"):
        assert result["per_meal"][macro] == 0.0
        assert result["per_100g"][macro] == 0.0
    assert result["portions"] == {}


def test_single_ingredient_per_100g_equals_its_own_macros_regardless_of_grams():
    ingredient = _ingredient(grams=250, calories=52, protein=0.3, fat=0.2, carbs=14, fiber=2.4, sugar=10, salt=0)
    result = calculate_recipe_nutrition([ingredient], [])
    assert result["per_meal"]["calories"] == pytest.approx(250 / 100 * 52)
    assert result["per_100g"]["calories"] == pytest.approx(52)
    assert result["per_100g"]["carbs"] == pytest.approx(14)


def test_multiple_ingredients_asymmetric_grams_sum_then_normalize():
    # 150g of a 300 kcal/100g ingredient + 30g of a 100 kcal/100g ingredient --
    # deliberately not an average of 100g/ingredient, so a "divide by ingredient
    # count" bug produces a different (wrong) answer than "divide by total grams".
    a = _ingredient(grams=150, calories=300, protein=10, fat=5, carbs=20, fiber=1, sugar=2, salt=0.1)
    b = _ingredient(grams=30, calories=100, protein=2, fat=1, carbs=5, fiber=0.5, sugar=1, salt=0.05)
    result = calculate_recipe_nutrition([a, b], [])

    expected_per_meal_calories = 150 / 100 * 300 + 30 / 100 * 100  # 450 + 30 = 480
    total_grams = 180
    expected_per_100g_calories = expected_per_meal_calories / total_grams * 100  # ~266.67

    assert result["per_meal"]["calories"] == pytest.approx(expected_per_meal_calories)
    assert result["per_100g"]["calories"] == pytest.approx(expected_per_100g_calories)
    # would equal this (wrong) value if normalization divided by ingredient count (2)
    # instead of total grams (180)
    assert result["per_100g"]["calories"] != pytest.approx(expected_per_meal_calories / 2)


def test_portion_math_above_and_below_100g():
    ingredient = _ingredient(grams=100, calories=200, protein=10, fat=5, carbs=20, fiber=2, sugar=5, salt=0.5)
    small = _portion(grams=50)
    large = _portion(grams=150)
    result = calculate_recipe_nutrition([ingredient], [small, large])

    assert result["portions"][small.id]["calories"] == 100.0  # 200 * 50/100
    assert result["portions"][large.id]["calories"] == 300.0  # 200 * 150/100


def test_unlinked_ingredient_contributes_identically_to_a_linked_one():
    linked = _ingredient(grams=100, calories=150, protein=5, fat=3, carbs=20, fiber=1, sugar=4, salt=0.2)
    linked.product_id = uuid.uuid4()
    unlinked = _ingredient(grams=100, calories=150, protein=5, fat=3, carbs=20, fiber=1, sugar=4, salt=0.2)
    unlinked.product_id = None

    linked_result = calculate_recipe_nutrition([linked], [])
    unlinked_result = calculate_recipe_nutrition([unlinked], [])

    assert linked_result["per_meal"] == unlinked_result["per_meal"]
    assert linked_result["per_100g"] == unlinked_result["per_100g"]
