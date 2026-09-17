import { Product } from '../store/productStore';
import { LogEntry, MealIngredientDefaults } from '../store/logStore';

const GRAMS_EPSILON = 0.5;

/** Diffs a logged meal-entry's resolved ingredient grams against the meal's
 * own default (portion-scaled) grams to count how many actually differ.
 * Returns 0 while the meal's defaults haven't been cached yet, rather than
 * showing a wrong/flickering count. */
export function computeAdjustedIngredientCount(
  entry: LogEntry,
  defaults: MealIngredientDefaults | undefined
): number {
  if (entry.source_type !== 'meal' || !entry.meal_ingredients || !defaults) return 0;

  // Same reference weight the backend scales portions against (log.py/nutrition.py):
  // cooked_weight_grams when the meal has one recorded, else the raw ingredient total.
  const referenceGrams = defaults.cookedWeightGrams ?? defaults.totalGrams;

  const scale = (() => {
    if (entry.portion_id) {
      // Compare against the portion's CURRENT grams (not what it was at log
      // time), so a portion resized since this entry was logged still shows
      // as adjusted -- that's the "meal changed since logging" case this tag
      // is also meant to catch, not just manual per-ingredient overrides.
      const portion = defaults.portions.find((p) => p.id === entry.portion_id);
      if (!portion || referenceGrams <= 0) return 1;
      return portion.grams / referenceGrams;
    }
    // No portion_id doesn't mean "unscaled" -- MealSourceStep.tsx's "By Grams"
    // and "N servings" tabs synthesize ingredient_overrides scaled by a ratio
    // with no portion_id to attach, so assuming scale=1 here flagged every
    // single ingredient as "adjusted" for those two tabs even with zero
    // manual changes. Derive the same ratio those tabs used from
    // quantity_grams (the logged weight, snapshotted once at log time)
    // instead. Falls back to 1 for pre-quantity_grams meal entries.
    if (!entry.quantity_grams || referenceGrams <= 0) return 1;
    return entry.quantity_grams / referenceGrams;
  })();

  // Accumulate rather than overwrite: a meal can link the same product in more
  // than one ingredient row (e.g. oil used twice), which would otherwise make
  // one of them silently clobber the other's expected/actual grams.
  const expected = new Map<string | null, number>();
  for (const ing of defaults.ingredients) {
    expected.set(ing.product_id, (expected.get(ing.product_id) ?? 0) + ing.grams * scale);
  }

  const actual = new Map<string | null, number>();
  for (const ing of entry.meal_ingredients) {
    actual.set(ing.product_id, (actual.get(ing.product_id) ?? 0) + ing.grams);
  }

  let adjusted = 0;
  for (const [key, expectedGrams] of expected) {
    const actualGrams = actual.get(key);
    if (actualGrams == null || Math.abs(actualGrams - expectedGrams) > GRAMS_EPSILON) {
      adjusted += 1;
    }
  }
  return adjusted;
}

/** Total logged grams for an entry, or null when the entry has no gram concept
 * (manual entries are macros only). Reads quantity_grams directly rather than
 * summing meal_ingredients -- for a meal entry, meal_ingredients is a
 * raw-ingredient-equivalent breakdown that only exists to drive the macro
 * calc (see backend/app/routers/log.py::_build_meal_snapshot); once the meal
 * has a cooked_weight_grams, that sum is *not* the weight that was logged.
 * quantity_grams is the actual logged weight (portion.grams, a custom
 * amount, or the meal's reference weight) for both source types. */
export function computeEntryTotalGrams(entry: LogEntry): number | null {
  if (entry.source_type === 'product' || entry.source_type === 'meal') return entry.quantity_grams;
  return null;
}

/** Scales every ingredient in a logged meal entry proportionally by the same
 * ratio its displayed amount (quantity_grams) is changing by, as
 * `ingredient_overrides` for PATCH /log/:id -- meal_ingredients has no
 * "total grams" of its own to scale against directly (it's a
 * raw-ingredient-equivalent, not the same unit as quantity_grams once the
 * meal has a cooked_weight_grams -- see computeEntryTotalGrams above), so the
 * ratio has to be derived from quantity_grams and applied to meal_ingredients,
 * not computed within either field alone. */
export function scaleMealIngredientsToTotal(
  entry: LogEntry,
  newTotalGrams: number
): { product_id: string; grams: number }[] | null {
  if (
    entry.source_type !== 'meal' ||
    !entry.meal_ingredients ||
    entry.meal_ingredients.length === 0 ||
    !entry.quantity_grams ||
    entry.quantity_grams <= 0
  ) {
    return null;
  }
  const scale = newTotalGrams / entry.quantity_grams;
  return entry.meal_ingredients
    .filter((i): i is { product_id: string; grams: number } => i.product_id != null)
    .map((i) => ({ product_id: i.product_id, grams: i.grams * scale }));
}

export function formatSourceExtra(entry: LogEntry, product?: Product): string {
  if (entry.source_type === 'product') {
    const grams = entry.quantity_grams != null ? `${Math.round(entry.quantity_grams)}G` : '';
    const brand = product?.brand ? product.brand.toUpperCase() : '';
    return [brand, grams].filter(Boolean).join(' · ');
  }
  if (entry.source_type === 'meal') {
    if (entry.portion_id) return '1 PORTION';
    if (entry.meal_ingredients && entry.meal_ingredients.length > 0) return 'BY GRAMS';
    return 'WHOLE MEAL';
  }
  return 'ENTERED BY HAND';
}
