"""Seed data for the `nutrients` reference table.

Shared by the Alembic migration and the test fixtures (tests build the schema
with create_all, not Alembic) so both always see the same rows.

Codes follow Open Food Facts nutriment keys. Nutrients the app calculates with
(calories, protein, fat, carbs, fiber, sugar, salt, saturated_fat) are typed
columns on `products` and are deliberately not listed here.

Row: (code, name, unit, category, parent_code, nrv)
- unit: canonical display unit; amounts are stored per 100 g in this unit.
- nrv: EU Regulation 1169/2011 Annex XIII reference value, None if none.
"""

NUTRIENT_SEED: list[tuple[str, str, str, str, str | None, float | None]] = [
    ("monounsaturated-fat", "Mono-unsaturates", "g", "fat", "fat", None),
    ("polyunsaturated-fat", "Polyunsaturates", "g", "fat", "fat", None),
    ("trans-fat", "Trans fat", "g", "fat", "fat", None),
    ("polyols", "Polyols", "g", "carbohydrate", "carbohydrates", None),
    ("starch", "Starch", "g", "carbohydrate", "carbohydrates", None),
    ("cholesterol", "Cholesterol", "mg", "other", None, None),
    ("vitamin-a", "Vitamin A", "µg", "vitamin", None, 800),
    ("vitamin-d", "Vitamin D", "µg", "vitamin", None, 5),
    ("vitamin-e", "Vitamin E", "mg", "vitamin", None, 12),
    ("vitamin-k", "Vitamin K", "µg", "vitamin", None, 75),
    ("vitamin-c", "Vitamin C", "mg", "vitamin", None, 80),
    ("vitamin-b1", "Thiamin (B1)", "mg", "vitamin", None, 1.1),
    ("vitamin-b2", "Riboflavin (B2)", "mg", "vitamin", None, 1.4),
    ("vitamin-pp", "Niacin (B3)", "mg", "vitamin", None, 16),
    ("vitamin-b6", "Vitamin B6", "mg", "vitamin", None, 1.4),
    ("vitamin-b9", "Folate (B9)", "µg", "vitamin", None, 200),
    ("vitamin-b12", "Vitamin B12", "µg", "vitamin", None, 2.5),
    ("potassium", "Potassium", "mg", "mineral", None, 2000),
    ("calcium", "Calcium", "mg", "mineral", None, 800),
    ("phosphorus", "Phosphorus", "mg", "mineral", None, 700),
    ("magnesium", "Magnesium", "mg", "mineral", None, 375),
    ("iron", "Iron", "mg", "mineral", None, 14),
    ("zinc", "Zinc", "mg", "mineral", None, 10),
    ("copper", "Copper", "mg", "mineral", None, 1),
    ("selenium", "Selenium", "µg", "mineral", None, 55),
    ("iodine", "Iodine", "µg", "mineral", None, 150),
]
