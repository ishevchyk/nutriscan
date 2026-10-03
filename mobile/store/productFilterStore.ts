import { create } from 'zustand';

import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  NutritionPreset,
  ProductFilters,
  ProductSort,
} from '../utils/productFilters';

/**
 * Products screen filter + sort state. Lives in a store (not screen state)
 * so it survives switching tabs. Session-only on purpose -- not persisted,
 * a fresh app launch starts unfiltered.
 */
interface ProductFilterState {
  filters: ProductFilters;
  sort: ProductSort;
  toggleGroup: (id: string) => void;
  toggleBrand: (key: string) => void;
  clearBrands: () => void;
  toggleNutrition: (preset: NutritionPreset) => void;
  setMaxCalories: (value: number | null) => void;
  toggleFavoritesOnly: () => void;
  /** Resets everything in the Filters sheet. Leaves favorites-only alone -- it has its own pill. */
  resetFilters: () => void;
  setSort: (sort: ProductSort) => void;
  resetSort: () => void;
  /** Called when a custom group is deleted, so a stale id can't linger in the filter. */
  dropGroup: (id: string) => void;
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export const useProductFilterStore = create<ProductFilterState>((set) => ({
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT,

  toggleGroup: (id) => set((s) => ({ filters: { ...s.filters, groupIds: toggle(s.filters.groupIds, id) } })),
  toggleBrand: (key) => set((s) => ({ filters: { ...s.filters, brands: toggle(s.filters.brands, key) } })),
  clearBrands: () => set((s) => ({ filters: { ...s.filters, brands: [] } })),
  toggleNutrition: (preset) =>
    set((s) => ({ filters: { ...s.filters, nutrition: toggle(s.filters.nutrition, preset) } })),
  setMaxCalories: (value) => set((s) => ({ filters: { ...s.filters, maxCalories: value } })),
  toggleFavoritesOnly: () => set((s) => ({ filters: { ...s.filters, favoritesOnly: !s.filters.favoritesOnly } })),
  resetFilters: () => set((s) => ({ filters: { ...EMPTY_FILTERS, favoritesOnly: s.filters.favoritesOnly } })),
  setSort: (sort) => set({ sort }),
  resetSort: () => set({ sort: DEFAULT_SORT }),
  dropGroup: (id) =>
    set((s) => ({ filters: { ...s.filters, groupIds: s.filters.groupIds.filter((g) => g !== id) } })),
}));
