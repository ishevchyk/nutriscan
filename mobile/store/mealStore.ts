import { create } from 'zustand';
import { api } from '../lib/api';
import { DELETED_RETENTION_DAYS, NewProduct, useProductStore } from './productStore';

export { DELETED_RETENTION_DAYS };

export interface NutritionOut {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number;
  salt: number;
}

export interface MealIngredient {
  id: string;
  product_id: string | null;
  is_linked: boolean;
  name: string;
  brand: string | null;
  grams: number;
  input_amount: number;
  input_unit: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
}

export interface MealPortion {
  id: string;
  name: string;
  grams: number;
  is_default: boolean;
  nutrition: NutritionOut;
}

export interface MealSummary {
  id: string;
  name: string;
  photo_url: string | null;
  updated_at: string;
}

export interface Meal {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  servings: number;
  cooked_weight_grams: number | null;
  created_at: string;
  updated_at: string;
  ingredients: MealIngredient[];
  nutrition: {
    per_meal: NutritionOut;
    per_100g: NutritionOut;
  };
  portions: MealPortion[];
}

export type LinkedIngredientInput = { product_id: string; input_amount: number; input_unit: string };
export type ManualIngredientInput = {
  name: string;
  brand?: string | null;
  input_amount: number;
  input_unit: string;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  salt?: number | null;
};
export type IngredientInput = LinkedIngredientInput | ManualIngredientInput;

export interface NewMeal {
  name: string;
  description?: string | null;
  photo_url?: string | null;
  servings?: number;
  cooked_weight_grams?: number | null;
  ingredients?: IngredientInput[];
}

export type MealPatch = Partial<NewMeal>;

export interface IngredientPatch {
  product_id?: string | null;
  input_amount?: number;
  input_unit?: string;
  name?: string;
  brand?: string | null;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  salt?: number | null;
}

export interface NewPortion {
  name: string;
  grams: number;
  is_default?: boolean;
}

export type PortionPatch = Partial<NewPortion>;

function toSummary(meal: Meal): MealSummary {
  return { id: meal.id, name: meal.name, photo_url: meal.photo_url, updated_at: meal.updated_at };
}

interface MealState {
  meals: MealSummary[];
  loaded: boolean;
  deletedMeals: MealSummary[];
  deletedLoaded: boolean;
  selected: Meal | null;
  selectedLoading: boolean;
  selectedError: string | null;

  loadMeals: () => Promise<void>;
  fetchMeal: (id: string) => Promise<void>;
  createMeal: (payload: NewMeal) => Promise<Meal>;
  updateMeal: (id: string, patch: MealPatch) => Promise<Meal>;
  removeMeal: (id: string) => Promise<void>;

  loadDeletedMeals: () => Promise<void>;
  restoreMeal: (id: string) => Promise<void>;

  addIngredient: (mealId: string, input: IngredientInput) => Promise<MealIngredient>;
  removeIngredient: (mealId: string, ingredientId: string) => Promise<void>;

  relinkIngredient: (
    mealId: string,
    ingredientId: string,
    productId: string,
    quantity?: { input_amount: number; input_unit: string }
  ) => Promise<void>;
  unlinkIngredient: (mealId: string, ingredientId: string) => Promise<void>;
  updateIngredientValues: (mealId: string, ingredientId: string, patch: Omit<IngredientPatch, 'product_id'>) => Promise<void>;
  addIngredientToLibrary: (mealId: string, ingredientId: string) => Promise<void>;

  addPortion: (mealId: string, input: NewPortion) => Promise<void>;
  updatePortion: (mealId: string, portionId: string, patch: PortionPatch) => Promise<void>;
  removePortion: (mealId: string, portionId: string) => Promise<void>;
}

export const useMealStore = create<MealState>((set, get) => ({
  meals: [],
  loaded: false,
  deletedMeals: [],
  deletedLoaded: false,
  selected: null,
  selectedLoading: false,
  selectedError: null,

  loadMeals: async () => {
    const { data } = await api.get<MealSummary[]>('/meals');
    set({ meals: data, loaded: true });
  },

  fetchMeal: async (id) => {
    set({ selectedLoading: true, selectedError: null });
    try {
      const { data } = await api.get<Meal>(`/meals/${id}`);
      set({ selected: data, selectedLoading: false });
    } catch (err) {
      set({ selectedLoading: false, selectedError: 'Failed to load meal.' });
      throw err;
    }
  },

  createMeal: async (payload) => {
    const { data } = await api.post<Meal>('/meals', payload);
    set({ meals: [toSummary(data), ...get().meals], selected: data });
    return data;
  },

  updateMeal: async (id, patch) => {
    const { data } = await api.patch<Meal>(`/meals/${id}`, patch);
    set({
      meals: get().meals.map((m) => (m.id === id ? toSummary(data) : m)),
      selected: get().selected?.id === id ? data : get().selected,
    });
    return data;
  },

  removeMeal: async (id) => {
    const previous = get().meals;
    set({
      meals: previous.filter((m) => m.id !== id),
      selected: get().selected?.id === id ? null : get().selected,
    });
    try {
      await api.delete(`/meals/${id}`);
    } catch (err) {
      set({ meals: previous });
      throw err;
    }
  },

  loadDeletedMeals: async () => {
    const { data } = await api.get<MealSummary[]>('/meals/deleted');
    set({ deletedMeals: data, deletedLoaded: true });
  },

  restoreMeal: async (id) => {
    const { data } = await api.post<Meal>(`/meals/${id}/restore`);
    set({
      deletedMeals: get().deletedMeals.filter((m) => m.id !== id),
      meals: [toSummary(data), ...get().meals],
    });
  },

  addIngredient: async (mealId, input) => {
    const { data } = await api.post<MealIngredient>(`/meals/${mealId}/ingredients`, input);
    await get().fetchMeal(mealId);
    return data;
  },

  removeIngredient: async (mealId, ingredientId) => {
    await api.delete(`/meals/${mealId}/ingredients/${ingredientId}`);
    await get().fetchMeal(mealId);
  },

  relinkIngredient: async (mealId, ingredientId, productId, quantity) => {
    await api.patch(`/meals/${mealId}/ingredients/${ingredientId}`, {
      product_id: productId,
      ...(quantity ? { input_amount: quantity.input_amount, input_unit: quantity.input_unit } : {}),
    });
    await get().fetchMeal(mealId);
  },

  unlinkIngredient: async (mealId, ingredientId) => {
    const current = get().selected;
    const ingredient = current?.ingredients.find((i) => i.id === ingredientId);
    await api.patch(`/meals/${mealId}/ingredients/${ingredientId}`, {
      product_id: null,
      // Unlinked ingredients only ever offer the "g" unit going forward (no
      // product left to key a household-unit conversion off of), so convert
      // the display to plain grams at the moment of unlinking.
      ...(ingredient ? { input_amount: ingredient.grams, input_unit: 'g' } : {}),
    });
    await get().fetchMeal(mealId);
  },

  updateIngredientValues: async (mealId, ingredientId, patch) => {
    await api.patch(`/meals/${mealId}/ingredients/${ingredientId}`, patch);
    await get().fetchMeal(mealId);
  },

  addIngredientToLibrary: async (mealId, ingredientId) => {
    const current = get().selected;
    if (!current || current.id !== mealId) return;
    const ingredient = current.ingredients.find((i) => i.id === ingredientId);
    if (!ingredient) return;
    const newProduct: NewProduct = {
      name: ingredient.name,
      brand: ingredient.brand,
      calories: ingredient.calories,
      protein: ingredient.protein,
      fat: ingredient.fat,
      carbs: ingredient.carbs,
      fiber: ingredient.fiber,
      sugar: ingredient.sugar,
      salt: ingredient.salt,
    };
    const product = await useProductStore.getState().addProduct(newProduct);
    await get().relinkIngredient(mealId, ingredientId, product.id);
  },

  addPortion: async (mealId, input) => {
    await api.post(`/meals/${mealId}/portions`, input);
    await get().fetchMeal(mealId);
  },

  updatePortion: async (mealId, portionId, patch) => {
    await api.patch(`/meals/${mealId}/portions/${portionId}`, patch);
    await get().fetchMeal(mealId);
  },

  removePortion: async (mealId, portionId) => {
    await api.delete(`/meals/${mealId}/portions/${portionId}`);
    await get().fetchMeal(mealId);
  },
}));
