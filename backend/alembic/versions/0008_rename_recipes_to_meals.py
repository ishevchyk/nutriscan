"""rename recipes, recipe_ingredients, recipe_portions to meals, meal_ingredients, meal_portions

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("recipes", "meals")
    op.rename_table("recipe_ingredients", "meal_ingredients")
    op.rename_table("recipe_portions", "meal_portions")

    op.alter_column("meal_ingredients", "recipe_id", new_column_name="meal_id")
    op.alter_column("meal_portions", "recipe_id", new_column_name="meal_id")

    # Table RENAME TO does not rename dependent constraint/index names in
    # Postgres -- they'd otherwise keep the old "recipe*" names forever.
    op.execute("ALTER TABLE meals RENAME CONSTRAINT recipes_pkey TO meals_pkey")
    op.execute("ALTER TABLE meal_ingredients RENAME CONSTRAINT recipe_ingredients_pkey TO meal_ingredients_pkey")
    op.execute("ALTER TABLE meal_portions RENAME CONSTRAINT recipe_portions_pkey TO meal_portions_pkey")

    op.execute("ALTER TABLE meals RENAME CONSTRAINT recipes_user_id_fkey TO meals_user_id_fkey")
    op.execute(
        "ALTER TABLE meal_ingredients RENAME CONSTRAINT recipe_ingredients_recipe_id_fkey "
        "TO meal_ingredients_meal_id_fkey"
    )
    op.execute(
        "ALTER TABLE meal_ingredients RENAME CONSTRAINT recipe_ingredients_product_id_fkey "
        "TO meal_ingredients_product_id_fkey"
    )
    op.execute(
        "ALTER TABLE meal_portions RENAME CONSTRAINT recipe_portions_recipe_id_fkey "
        "TO meal_portions_meal_id_fkey"
    )

    op.execute("ALTER INDEX ix_recipes_user_id RENAME TO ix_meals_user_id")
    op.execute("ALTER INDEX ix_recipe_ingredients_recipe_id RENAME TO ix_meal_ingredients_meal_id")
    op.execute("ALTER INDEX ix_recipe_ingredients_product_id RENAME TO ix_meal_ingredients_product_id")
    op.execute("ALTER INDEX ix_recipe_portions_recipe_id RENAME TO ix_meal_portions_meal_id")
    op.execute("ALTER INDEX ux_recipe_portions_recipe_id_default RENAME TO ux_meal_portions_meal_id_default")


def downgrade() -> None:
    op.execute("ALTER INDEX ux_meal_portions_meal_id_default RENAME TO ux_recipe_portions_recipe_id_default")
    op.execute("ALTER INDEX ix_meal_portions_meal_id RENAME TO ix_recipe_portions_recipe_id")
    op.execute("ALTER INDEX ix_meal_ingredients_product_id RENAME TO ix_recipe_ingredients_product_id")
    op.execute("ALTER INDEX ix_meal_ingredients_meal_id RENAME TO ix_recipe_ingredients_recipe_id")
    op.execute("ALTER INDEX ix_meals_user_id RENAME TO ix_recipes_user_id")

    op.execute(
        "ALTER TABLE meal_portions RENAME CONSTRAINT meal_portions_meal_id_fkey "
        "TO recipe_portions_recipe_id_fkey"
    )
    op.execute(
        "ALTER TABLE meal_ingredients RENAME CONSTRAINT meal_ingredients_product_id_fkey "
        "TO recipe_ingredients_product_id_fkey"
    )
    op.execute(
        "ALTER TABLE meal_ingredients RENAME CONSTRAINT meal_ingredients_meal_id_fkey "
        "TO recipe_ingredients_recipe_id_fkey"
    )
    op.execute("ALTER TABLE meals RENAME CONSTRAINT meals_user_id_fkey TO recipes_user_id_fkey")

    op.execute("ALTER TABLE meal_portions RENAME CONSTRAINT meal_portions_pkey TO recipe_portions_pkey")
    op.execute("ALTER TABLE meal_ingredients RENAME CONSTRAINT meal_ingredients_pkey TO recipe_ingredients_pkey")
    op.execute("ALTER TABLE meals RENAME CONSTRAINT meals_pkey TO recipes_pkey")

    op.alter_column("meal_portions", "meal_id", new_column_name="recipe_id")
    op.alter_column("meal_ingredients", "meal_id", new_column_name="recipe_id")

    op.rename_table("meal_portions", "recipe_portions")
    op.rename_table("meal_ingredients", "recipe_ingredients")
    op.rename_table("meals", "recipes")
