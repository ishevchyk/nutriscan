import { create } from 'zustand';
import { api } from '../lib/api';

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
}

// Must match backend/app/jobs.py RETENTION_DAYS
export const DELETED_RETENTION_DAYS = 30;

export type NewProduct = Pick<Product, 'name'> &
  Partial<
    Omit<
      Product,
      'id' | 'user_id' | 'name' | 'created_at' | 'updated_at'
    >
  >;

interface ProductState {
  products: Product[];
  loaded: boolean;
  deletedProducts: Product[];
  deletedLoaded: boolean;
  loadProducts: () => Promise<void>;
  addProduct: (p: NewProduct) => Promise<void>;
  updateProduct: (id: string, patch: Partial<NewProduct>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  loadDeletedProducts: () => Promise<void>;
  restoreProduct: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loaded: false,
  deletedProducts: [],
  deletedLoaded: false,

  loadProducts: async () => {
    const { data } = await api.get<Product[]>('/products');
    set({ products: data, loaded: true });
  },

  addProduct: async (fields) => {
    const { data } = await api.post<Product>('/products', fields);
    set({ products: [data, ...get().products] });
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
}));
