import { NutritionOut } from '../store/mealStore';

export type IngredientNutritionInput = {
  grams: number;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber?: number | null;
  sugar?: number | null;
  salt?: number | null;
  saturated_fat?: number | null;
  nutrients?: Record<string, number> | null;
};

export const NUTRITION_ZERO: NutritionOut = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sugar: 0,
  salt: 0,
  saturated_fat: 0,
};

const MACROS = ['calories', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt', 'saturated_fat'] as const;

/** Client-side mirror of backend/app/nutrition.py: macros are per 100g,
 * per_meal = Σ grams/100 × macro, per_100g normalized by total grams. */
export function computeIngredientsNutrition(items: IngredientNutritionInput[]): {
  per_meal: NutritionOut;
  per_100g: NutritionOut;
  totalGrams: number;
} {
  const perMeal: NutritionOut = { ...NUTRITION_ZERO };
  let totalGrams = 0;
  const nutrients: Record<string, number> = {};
  for (const item of items) {
    totalGrams += item.grams;
    for (const macro of MACROS) {
      perMeal[macro] += (item.grams / 100) * (item[macro] ?? 0);
    }
    for (const [code, amount] of Object.entries(item.nutrients ?? {})) {
      nutrients[code] = (nutrients[code] ?? 0) + (item.grams / 100) * amount;
    }
  }
  // A code is partial when some ingredient has no value for it (mirrors
  // backend calculate_meal_nutrition), so totals can render as "≥ x".
  perMeal.nutrients = nutrients;
  perMeal.nutrients_partial = Object.keys(nutrients).filter((code) => items.some((i) => i.nutrients?.[code] == null));
  const per100g = totalGrams > 0 ? scaleNutrition(perMeal, 100 / totalGrams) : { ...NUTRITION_ZERO };
  return { per_meal: perMeal, per_100g: per100g, totalGrams };
}

export function scaleNutrition(nutrition: NutritionOut, factor: number): NutritionOut {
  const scaled = { ...NUTRITION_ZERO };
  for (const macro of MACROS) {
    scaled[macro] = nutrition[macro] * factor;
  }
  scaled.nutrients = Object.fromEntries(
    Object.entries(nutrition.nutrients ?? {}).map(([code, amount]) => [code, amount * factor])
  );
  scaled.nutrients_partial = nutrition.nutrients_partial ?? [];
  return scaled;
}

export function perPortion(perMeal: NutritionOut, servings: number): NutritionOut {
  return servings > 0 ? scaleNutrition(perMeal, 1 / servings) : { ...perMeal };
}
