import { create } from 'zustand';
import { api } from '../lib/api';
import { Group } from './types';

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
  serving_size: number | null;
  serving_unit: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  groups: Group[];
}

// Must match backend/app/jobs.py RETENTION_DAYS
export const DELETED_RETENTION_DAYS = 30;

export type NewProduct = Pick<Product, 'name'> &
  Partial<
    Omit<
      Product,
      'id' | 'user_id' | 'name' | 'created_at' | 'updated_at' | 'groups'
    >
  >;

interface ProductState {
  products: Product[];
  loaded: boolean;
  deletedProducts: Product[];
  deletedLoaded: boolean;
  loadProducts: (groupId?: string) => Promise<void>;
  addProduct: (p: NewProduct) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<NewProduct>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  loadDeletedProducts: () => Promise<void>;
  restoreProduct: (id: string) => Promise<void>;
  assignProductToGroups: (productId: string, groupIds: string[]) => Promise<void>;
  removeProductFromGroup: (productId: string, groupId: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loaded: false,
  deletedProducts: [],
  deletedLoaded: false,

  loadProducts: async (groupId) => {
    const { data } = await api.get<Product[]>('/products', {
      params: groupId ? { group_id: groupId } : undefined,
    });
    set({ products: data, loaded: true });
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
}));
