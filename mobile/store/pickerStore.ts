import { create } from 'zustand';
import { Product } from './productStore';
import { ProductFormValues } from '../hooks/useProductForm';

/** Result of the add-product-for-recipe flow: a product saved to the library,
 * form values for a recipe-only (unlinked) ingredient, or null on dismiss. */
export type AddProductResult =
  | { kind: 'library'; product: Product }
  | { kind: 'recipeOnly'; values: ProductFormValues }
  | null;

interface PickerState {
  resolver: ((product: Product | null) => void) | null;
  setResolver: (fn: (product: Product | null) => void) => void;
  resolve: (product: Product | null) => void;

  addProductResolver: ((result: AddProductResult) => void) | null;
  setAddProductResolver: (fn: (result: AddProductResult) => void) => void;
  resolveAddProduct: (result: AddProductResult) => void;
}

export const usePickerStore = create<PickerState>((set, get) => ({
  resolver: null,
  setResolver: (fn) => set({ resolver: fn }),
  resolve: (product) => {
    get().resolver?.(product);
    set({ resolver: null });
  },

  addProductResolver: null,
  setAddProductResolver: (fn) => set({ addProductResolver: fn }),
  resolveAddProduct: (result) => {
    get().addProductResolver?.(result);
    set({ addProductResolver: null });
  },
}));
