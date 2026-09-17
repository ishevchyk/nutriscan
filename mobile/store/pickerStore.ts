import { create } from 'zustand';
import { Product } from './productStore';
import { MealSummary } from './mealStore';
import { ProductFormValues } from '../hooks/useProductForm';

/** Result of the add-product-for-meal flow: a product saved to the library,
 * form values for a meal-only (unlinked) ingredient, or null on dismiss. */
export type AddProductResult =
  | { kind: 'library'; product: Product }
  | { kind: 'mealOnly'; values: ProductFormValues }
  | null;

interface PickerState {
  resolver: ((product: Product | null) => void) | null;
  setResolver: (fn: (product: Product | null) => void) => void;
  resolve: (product: Product | null) => void;

  addProductResolver: ((result: AddProductResult) => void) | null;
  setAddProductResolver: (fn: (result: AddProductResult) => void) => void;
  resolveAddProduct: (result: AddProductResult) => void;

  mealResolver: ((meal: MealSummary | null) => void) | null;
  setMealResolver: (fn: (meal: MealSummary | null) => void) => void;
  resolveMeal: (meal: MealSummary | null) => void;
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

  mealResolver: null,
  setMealResolver: (fn) => set({ mealResolver: fn }),
  resolveMeal: (meal) => {
    get().mealResolver?.(meal);
    set({ mealResolver: null });
  },
}));
