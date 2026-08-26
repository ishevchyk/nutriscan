import { create } from 'zustand';
import { api } from '../lib/api';

export interface ProductUnitConversion {
  id: string;
  product_id: string;
  unit: string;
  grams_per_unit: number;
}

interface UnitConversionState {
  byProduct: Record<string, ProductUnitConversion[]>;
  loadedProducts: Record<string, boolean>;

  /** Fetches and caches a product's saved conversions; no-op if already loaded. */
  ensureLoaded: (productId: string) => Promise<void>;
  /** Cache-only lookup — returns null if unresolved (call ensureLoaded first). */
  getGramsPerUnit: (productId: string, unit: string) => number | null;
  saveConversion: (productId: string, unit: string, gramsPerUnit: number) => Promise<ProductUnitConversion>;
}

export const useUnitConversionStore = create<UnitConversionState>((set, get) => ({
  byProduct: {},
  loadedProducts: {},

  ensureLoaded: async (productId) => {
    if (get().loadedProducts[productId]) return;
    const { data } = await api.get<ProductUnitConversion[]>(`/products/${productId}/unit-conversions`);
    set((s) => ({
      byProduct: { ...s.byProduct, [productId]: data },
      loadedProducts: { ...s.loadedProducts, [productId]: true },
    }));
  },

  getGramsPerUnit: (productId, unit) => {
    const list = get().byProduct[productId];
    return list?.find((c) => c.unit === unit)?.grams_per_unit ?? null;
  },

  saveConversion: async (productId, unit, gramsPerUnit) => {
    const { data } = await api.post<ProductUnitConversion>(`/products/${productId}/unit-conversions`, {
      unit,
      grams_per_unit: gramsPerUnit,
    });
    set((s) => {
      const existing = s.byProduct[productId] ?? [];
      const next = existing.some((c) => c.unit === unit)
        ? existing.map((c) => (c.unit === unit ? data : c))
        : [...existing, data];
      return {
        byProduct: { ...s.byProduct, [productId]: next },
        loadedProducts: { ...s.loadedProducts, [productId]: true },
      };
    });
    return data;
  },
}));
