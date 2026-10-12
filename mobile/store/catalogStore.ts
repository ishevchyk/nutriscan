import { create } from 'zustand';
import { api } from '../lib/api';
import { Product, useProductStore } from './productStore';

export type Completeness = 'complete' | 'partial' | 'no_nutrition';

export interface DraftPortion {
  name: string;
  grams: number;
  is_default: boolean;
}

export interface CatalogDraft {
  name: string;
  brand: string | null;
  barcode: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
  saturated_fat: number | null;
  nutrients: Record<string, number>;
  notes: string | null;
  portions: DraftPortion[];
  suggested_group: string | null;
  suggested_group_id: string | null;
  completeness: Completeness;
  image_url: string | null;
  off_url: string;
  already_in_library: { product_id: string; deleted: boolean } | null;
}

export interface CatalogHit {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  image_url: string | null;
  kcal_100g: number | null;
}

export interface CatalogSearchPage {
  items: CatalogHit[];
  page: number;
  has_more: boolean;
}

interface CatalogState {
  /** Handed from the search/scan screens to Add Product, which applies and clears it. */
  draft: CatalogDraft | null;
  /** "Not in Open Food Facts -> Enter manually": prefill just the barcode. */
  prefillBarcode: string | null;
  setDraft: (draft: CatalogDraft | null) => void;
  setPrefillBarcode: (code: string | null) => void;
  search: (q: string, page: number) => Promise<CatalogSearchPage>;
  lookup: (code: string) => Promise<CatalogDraft>;
  importProduct: (body: Record<string, unknown>) => Promise<Product>;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  draft: null,
  prefillBarcode: null,
  setDraft: (draft) => set({ draft }),
  setPrefillBarcode: (prefillBarcode) => set({ prefillBarcode }),

  search: async (q, page) => {
    const { data } = await api.get<CatalogSearchPage>('/catalog/search', { params: { q, page } });
    return data;
  },

  lookup: async (code) => {
    const { data } = await api.get<CatalogDraft>(`/catalog/barcode/${encodeURIComponent(code)}`);
    return data;
  },

  importProduct: async (body) => {
    const { data } = await api.post<Product>('/catalog/import', body);
    useProductStore.setState((s) => ({ products: [data, ...s.products] }));
    return data;
  },
}));
