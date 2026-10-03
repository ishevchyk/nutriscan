import type { Product } from '../store/productStore';

/**
 * Products screen filtering + sorting. Everything here runs client-side on
 * the already-loaded library (products are per-user and small), so the
 * store's product list stays complete for the tracker and pickers.
 * All nutrition thresholds are per 100g, matching how products are stored.
 */

export type NutritionPreset = 'high_protein' | 'low_calorie' | 'low_carb' | 'low_fat';

export const NUTRITION_PRESETS: {
  key: NutritionPreset;
  label: string;
  hint: string;
  test: (p: Product) => boolean;
}[] = [
  { key: 'high_protein', label: 'High protein', hint: '≥ 10 g protein', test: (p) => p.protein != null && p.protein >= 10 },
  { key: 'low_calorie', label: 'Low calorie', hint: '≤ 100 kcal', test: (p) => p.calories != null && p.calories <= 100 },
  { key: 'low_carb', label: 'Low carb', hint: '≤ 10 g carbs', test: (p) => p.carbs != null && p.carbs <= 10 },
  { key: 'low_fat', label: 'Low fat', hint: '≤ 3 g fat', test: (p) => p.fat != null && p.fat <= 3 },
];

export type ProductFilters = {
  /** Match ANY of these groups. Empty = no group filter. */
  groupIds: string[];
  /** Match ANY of these brands (normalized via brandKey). Empty = any brand. */
  brands: string[];
  /** Every selected preset must hold (AND) -- "high protein + low fat" narrows. */
  nutrition: NutritionPreset[];
  /** Per-100g kcal ceiling; null = any. */
  maxCalories: number | null;
  favoritesOnly: boolean;
};

export const EMPTY_FILTERS: ProductFilters = {
  groupIds: [],
  brands: [],
  nutrition: [],
  maxCalories: null,
  favoritesOnly: false,
};

export type ProductSort = 'recently_logged' | 'most_logged' | 'name' | 'calories_asc' | 'protein_desc';

export const DEFAULT_SORT: ProductSort = 'recently_logged';

export const SORT_OPTIONS: { key: ProductSort; label: string; short: string }[] = [
  { key: 'recently_logged', label: 'Recently logged', short: 'Recently logged' },
  { key: 'most_logged', label: 'Most logged', short: 'Most logged' },
  { key: 'name', label: 'Name A–Z', short: 'Name' },
  { key: 'calories_asc', label: 'Calories: low → high', short: 'Calories' },
  { key: 'protein_desc', label: 'Protein: high → low', short: 'Protein' },
];

/** Case/whitespace-insensitive key, so "Kaufland " and "kaufland" are one brand. */
export function brandKey(brand: string): string {
  return brand.trim().toLocaleLowerCase();
}

export type BrandOption = { key: string; label: string; count: number };

/** Distinct brands in the library with product counts, A–Z. Unbranded products are skipped. */
export function getBrandOptions(products: Product[]): BrandOption[] {
  const byKey = new Map<string, BrandOption>();
  for (const p of products) {
    const label = p.brand?.trim();
    if (!label) continue;
    const key = brandKey(label);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { key, label, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Filters that should actually apply. Selected groups the user has since
 * hidden (or that no longer exist) are ignored rather than silently
 * filtering everything out with no visible chip to undo it.
 */
export function effectiveFilters(filters: ProductFilters, visibleGroupIds: Set<string>): ProductFilters {
  return { ...filters, groupIds: filters.groupIds.filter((id) => visibleGroupIds.has(id)) };
}

export function applyProductFilters(products: Product[], filters: ProductFilters, searchQuery = ''): Product[] {
  const query = searchQuery.trim().toLocaleLowerCase();
  const groupIds = new Set(filters.groupIds);
  const brands = new Set(filters.brands);
  const presets = NUTRITION_PRESETS.filter((n) => filters.nutrition.includes(n.key));

  return products.filter((p) => {
    if (filters.favoritesOnly && !p.is_favorite) return false;
    if (groupIds.size > 0 && !p.groups.some((g) => groupIds.has(g.id))) return false;
    if (brands.size > 0 && !(p.brand && brands.has(brandKey(p.brand)))) return false;
    if (presets.some((preset) => !preset.test(p))) return false;
    if (filters.maxCalories != null && (p.calories == null || p.calories > filters.maxCalories)) return false;
    if (query) {
      const inName = p.name.toLocaleLowerCase().includes(query);
      const inBrand = (p.brand ?? '').toLocaleLowerCase().includes(query);
      if (!inName && !inBrand) return false;
    }
    return true;
  });
}

/** How many filter "things" are on -- drives the FILTERS pill's badge. Favorites has its own pill. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    filters.groupIds.length +
    filters.brands.length +
    filters.nutrition.length +
    (filters.maxCalories != null ? 1 : 0)
  );
}

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name);

/** Nulls always sort last, whatever the direction. */
function compareNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

export function sortProducts(products: Product[], sort: ProductSort): Product[] {
  const sorted = [...products];
  switch (sort) {
    case 'recently_logged':
      return sorted.sort((a, b) => {
        const at = a.last_logged_at ? Date.parse(a.last_logged_at) : null;
        const bt = b.last_logged_at ? Date.parse(b.last_logged_at) : null;
        // Never-logged products fall back to newest-added first, so a
        // freshly added product is still easy to find.
        if (at == null && bt == null) return Date.parse(b.created_at) - Date.parse(a.created_at);
        return compareNullable(at, bt, -1) || byName(a, b);
      });
    case 'most_logged':
      return sorted.sort((a, b) => b.log_count - a.log_count || byName(a, b));
    case 'name':
      return sorted.sort(byName);
    case 'calories_asc':
      return sorted.sort((a, b) => compareNullable(a.calories, b.calories, 1) || byName(a, b));
    case 'protein_desc':
      return sorted.sort((a, b) => compareNullable(a.protein, b.protein, -1) || byName(a, b));
  }
}

/** "today" / "yesterday" / "3 days ago" / "12 Sep" -- local calendar days, not 24h windows. */
export function formatLastLogged(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const logged = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(logged)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return logged.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(logged.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Upper bound for the max-calories slider: the library's highest kcal/100g, rounded up to 100 (min 100). */
export function caloriesSliderMax(products: Product[]): number {
  const highest = products.reduce((max, p) => (p.calories != null && p.calories > max ? p.calories : max), 0);
  return Math.max(100, Math.ceil(highest / 100) * 100);
}
