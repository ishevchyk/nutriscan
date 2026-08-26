import { MealIngredient } from '../../store/mealStore';

/** Normalized ingredient view-model rendered by IngredientCard and the sheets.
 * Server ingredients map with key = id; add-meal drafts generate local keys
 * and snapshot the picked product's macros so nutrition renders client-side. */
export type IngredientVM = {
  key: string;
  product_id: string | null;
  is_linked: boolean;
  name: string;
  brand: string | null;
  grams: number;
  input_amount: number;
  input_unit: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
};

export function toIngredientVM(ingredient: MealIngredient): IngredientVM {
  return {
    key: ingredient.id,
    product_id: ingredient.product_id,
    is_linked: ingredient.is_linked,
    name: ingredient.name,
    brand: ingredient.brand,
    grams: ingredient.grams,
    input_amount: ingredient.input_amount,
    input_unit: ingredient.input_unit,
    calories: ingredient.calories,
    protein: ingredient.protein,
    fat: ingredient.fat,
    carbs: ingredient.carbs,
    fiber: ingredient.fiber,
    sugar: ingredient.sugar,
    salt: ingredient.salt,
  };
}
