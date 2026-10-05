import { create } from 'zustand';
import { api } from '../lib/api';
import { Group } from './types';

export interface ProductPortion {
  id: string;
  name: string;
  grams: number;
  is_default: boolean;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
  saturated_fat: number | null;
  serving_size: number | null;
  serving_unit: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_favorite: boolean;
  groups: Group[];
  // Extended nutrients {code: amount per 100 g in the nutrient's own unit}; a
  // missing code means unknown (see nutrientStore for labels/units/NRVs).
  nutrients: Record<string, number>;
  portions: ProductPortion[];
  // Derived server-side from the log (direct product entries + logged meals
  // that include it) -- read-only, see backend products.py _attach_log_stats.
  last_logged_at: string | null;
  log_count: number;
}

// Must match backend/app/jobs.py RETENTION_DAYS
export const DELETED_RETENTION_DAYS = 30;

export type NewProduct = Pick<Product, 'name'> &
  Partial<
    Omit<
      Product,
      | 'id'
      | 'user_id'
      | 'name'
      | 'created_at'
      | 'updated_at'
      | 'groups'
      | 'portions'
      | 'nutrients'
      | 'last_logged_at'
      | 'log_count'
    >
  > & {
    // On PATCH a null amount clears that nutrient back to unknown.
    nutrients?: Record<string, number | null>;
  };

interface ProductState {
  products: Product[];
  loaded: boolean;
  // Set by logStore whenever a log entry is added/edited/removed -- the
  // products' last_logged_at/log_count are then out of date, and the Products
  // tab refetches the next time it gains focus.
  statsStale: boolean;
  deletedProducts: Product[];
  deletedLoaded: boolean;
  loadProducts: () => Promise<void>;
  markStatsStale: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  addProduct: (p: NewProduct) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<NewProduct>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  loadDeletedProducts: () => Promise<void>;
  restoreProduct: (id: string) => Promise<void>;
  assignProductToGroups: (productId: string, groupIds: string[]) => Promise<void>;
  removeProductFromGroup: (productId: string, groupId: string) => Promise<void>;
  addPortion: (productId: string, portion: Omit<ProductPortion, 'id'>) => Promise<ProductPortion>;
  updatePortion: (productId: string, portionId: string, patch: Partial<Omit<ProductPortion, 'id'>>) => Promise<void>;
  removePortion: (productId: string, portionId: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loaded: false,
  statsStale: false,
  deletedProducts: [],
  deletedLoaded: false,

  // Always loads the full library: group/brand/nutrition filtering happens
  // client-side on the Products screen (utils/productFilters.ts), so the
  // store's list stays complete for the tracker and pickers that share it.
  loadProducts: async () => {
    const { data } = await api.get<Product[]>('/products');
    set({ products: data, loaded: true, statsStale: false });
  },

  markStatsStale: () => set({ statsStale: true }),

  // Optimistic with rollback -- a heart tap should feel instant.
  toggleFavorite: async (id) => {
    const current = get().products.find((p) => p.id === id);
    if (!current) return;
    const next = !current.is_favorite;
    const setFavorite = (value: boolean) =>
      set({ products: get().products.map((p) => (p.id === id ? { ...p, is_favorite: value } : p)) });
    setFavorite(next);
    try {
      await api.patch<Product>(`/products/${id}`, { is_favorite: next });
    } catch (err) {
      setFavorite(current.is_favorite);
      throw err;
    }
  },

  addProduct: async (fields) => {
    const { data } = await api.post<Product>('/products', fields);
    set({ products: [data, ...get().products] });
    return data;
  },

  updateProduct: async (id, patch) => {
    const { data } = await api.patch<Product>(`/products/${id}`, patch);
    set({ products: get().products.map((p) => (p.id === id ? data : p)) });
  },

  removeProduct: async (id) => {
    await api.delete(`/products/${id}`);
    set({ products: get().products.filter((p) => p.id !== id) });
  },

  loadDeletedProducts: async () => {
    const { data } = await api.get<Product[]>('/products/deleted');
    set({ deletedProducts: data, deletedLoaded: true });
  },

  restoreProduct: async (id) => {
    const { data } = await api.post<Product>(`/products/${id}/restore`);
    set({
      deletedProducts: get().deletedProducts.filter((p) => p.id !== id),
      products: [data, ...get().products],
    });
  },

  assignProductToGroups: async (productId, groupIds) => {
    const { data } = await api.post<Group[]>(`/products/${productId}/groups`, { group_ids: groupIds });
    set({
      products: get().products.map((p) => (p.id === productId ? { ...p, groups: data } : p)),
    });
  },

  removeProductFromGroup: async (productId, groupId) => {
    await api.delete(`/products/${productId}/groups/${groupId}`);
    set({
      products: get().products.map((p) =>
        p.id === productId ? { ...p, groups: p.groups.filter((g) => g.id !== groupId) } : p
      ),
    });
  },

  // Portions change at most one default server-side, so every portion write
  // refetches the product's list instead of patching it locally.
  addPortion: async (productId, portion) => {
    const { data } = await api.post<ProductPortion>(`/products/${productId}/portions`, portion);
    await refreshPortions(productId);
    return data;
  },

  updatePortion: async (productId, portionId, patch) => {
    await api.patch(`/products/${productId}/portions/${portionId}`, patch);
    await refreshPortions(productId);
  },

  removePortion: async (productId, portionId) => {
    await api.delete(`/products/${productId}/portions/${portionId}`);
    await refreshPortions(productId);
  },
}));

async function refreshPortions(productId: string) {
  const { data } = await api.get<ProductPortion[]>(`/products/${productId}/portions`);
  useProductStore.setState((s) => ({
    products: s.products.map((p) => (p.id === productId ? { ...p, portions: data } : p)),
  }));
}
