import { Product } from '../store/productStore';
import { Nutrient } from '../store/nutrientStore';

/** EU adult reference intakes (Regulation 1169/2011) used for %RI. */
export const REFERENCE_INTAKE = {
  calories: 2000,
  fat: 70,
  saturated_fat: 20,
  carbs: 260,
  sugar: 90,
  protein: 50,
  salt: 6,
} as const;

export const KJ_PER_KCAL = 4.184;

export type FactKey = keyof typeof REFERENCE_INTAKE | 'fiber';

export type BreakdownRow = {
  key: string;
  label: string;
  unit: string;
  /** Nested under a parent (saturates under fat, sugars under carbs...). */
  child: boolean;
  /** Mandatory on EU labels, so shown even when empty. */
  required: boolean;
  /** Typed product column (editable via the form's own field), else an extended nutrient code. */
  column: FactKey | null;
  code: string | null;
  referenceIntake: number | null;
};

const row = (
  key: string,
  label: string,
  unit: string,
  extra: Partial<BreakdownRow>
): BreakdownRow => ({
  key,
  label,
  unit,
  child: false,
  required: false,
  column: null,
  code: null,
  referenceIntake: null,
  ...extra,
});

/** Display order of the EU-label breakdown. Typed columns come from the
 * product row; the rest are extended nutrients keyed by code. */
export const BREAKDOWN_ROWS: BreakdownRow[] = [
  row('calories', 'Energy', 'kcal', { column: 'calories', required: true, referenceIntake: REFERENCE_INTAKE.calories }),
  row('fat', 'Fat', 'g', { column: 'fat', required: true, referenceIntake: REFERENCE_INTAKE.fat }),
  row('saturated_fat', 'of which saturates', 'g', { column: 'saturated_fat', child: true, required: true, referenceIntake: REFERENCE_INTAKE.saturated_fat }),
  row('monounsaturated-fat', 'mono-unsaturates', 'g', { code: 'monounsaturated-fat', child: true }),
  row('polyunsaturated-fat', 'polyunsaturates', 'g', { code: 'polyunsaturated-fat', child: true }),
  row('trans-fat', 'trans fat', 'g', { code: 'trans-fat', child: true }),
  row('carbs', 'Carbohydrate', 'g', { column: 'carbs', required: true, referenceIntake: REFERENCE_INTAKE.carbs }),
  row('sugar', 'of which sugars', 'g', { column: 'sugar', child: true, required: true, referenceIntake: REFERENCE_INTAKE.sugar }),
  row('polyols', 'polyols', 'g', { code: 'polyols', child: true }),
  row('starch', 'starch', 'g', { code: 'starch', child: true }),
  row('fiber', 'Fibre', 'g', { column: 'fiber' }),
  row('protein', 'Protein', 'g', { column: 'protein', required: true, referenceIntake: REFERENCE_INTAKE.protein }),
  row('salt', 'Salt', 'g', { column: 'salt', required: true, referenceIntake: REFERENCE_INTAKE.salt }),
  row('cholesterol', 'Cholesterol', 'mg', { code: 'cholesterol' }),
];

/** Value of a breakdown row for a product, per 100 g (null = unknown). */
export function rowValue(product: Pick<Product, FactKey | 'nutrients'>, r: BreakdownRow): number | null {
  if (r.column) return product[r.column] ?? null;
  if (r.code) return product.nutrients[r.code] ?? null;
  return null;
}

/** Compact amount: 3 significant-ish digits (116, 12.4, 0.37). */
export function formatFact(x: number): string {
  if (x >= 100) return String(Math.round(x));
  if (x >= 10) return String(Math.round(x * 10) / 10);
  return String(Math.round(x * 100) / 100);
}

export function percentOf(amount: number, reference: number): string {
  return `${Math.round((amount / reference) * 100)}%`;
}

export function microGroups(nutrients: Nutrient[]): { label: string; items: Nutrient[] }[] {
  const pick = (category: Nutrient['category']) =>
    nutrients.filter((n) => n.category === category).sort((a, b) => a.sort_order - b.sort_order);
  return [
    { label: 'Vitamins', items: pick('vitamin') },
    { label: 'Minerals', items: pick('mineral') },
  ];
}

/** Drops unknown (null/undefined) entries; null when nothing is left. Used when
 * copying a product's extended nutrients into a meal-ingredient snapshot. */
export function compactNutrients(
  map: Record<string, number | null | undefined> | null | undefined
): Record<string, number> | null {
  const entries = Object.entries(map ?? {}).filter((e): e is [string, number] => e[1] != null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
