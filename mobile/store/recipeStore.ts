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

export interface RecipeIngredient {
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

export interface RecipePortion {
  id: string;
  name: string;
  grams: number;
  is_default: boolean;
  nutrition: NutritionOut;
}

export interface RecipeSummary {
  id: string;
  name: string;
  photo_url: string | null;
  updated_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  servings: number;
  created_at: string;
  updated_at: string;
  ingredients: RecipeIngredient[];
  nutrition: {
    per_meal: NutritionOut;
    per_100g: NutritionOut;
  };
  portions: RecipePortion[];
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

export interface NewRecipe {
  name: string;
  description?: string | null;
  photo_url?: string | null;
  servings?: number;
  ingredients?: IngredientInput[];
}

export type RecipePatch = Partial<NewRecipe>;

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

function toIngredientInput(ing: RecipeIngredient): IngredientInput {
  if (ing.is_linked && ing.product_id) {
    return { product_id: ing.product_id, input_amount: ing.input_amount, input_unit: ing.input_unit };
  }
  return {
    name: ing.name,
    brand: ing.brand,
    input_amount: ing.input_amount,
    input_unit: ing.input_unit,
    calories: ing.calories,
    protein: ing.protein,
    fat: ing.fat,
    carbs: ing.carbs,
    fiber: ing.fiber,
    sugar: ing.sugar,
    salt: ing.salt,
  };
}

function toSummary(recipe: Recipe): RecipeSummary {
  return { id: recipe.id, name: recipe.name, photo_url: recipe.photo_url, updated_at: recipe.updated_at };
}

interface RecipeState {
  recipes: RecipeSummary[];
  loaded: boolean;
  deletedRecipes: RecipeSummary[];
  deletedLoaded: boolean;
  selected: Recipe | null;
  selectedLoading: boolean;
  selectedError: string | null;

  loadRecipes: () => Promise<void>;
  fetchRecipe: (id: string) => Promise<void>;
  createRecipe: (payload: NewRecipe) => Promise<Recipe>;
  updateRecipe: (id: string, patch: RecipePatch) => Promise<Recipe>;
  removeRecipe: (id: string) => Promise<void>;

  loadDeletedRecipes: () => Promise<void>;
  restoreRecipe: (id: string) => Promise<void>;

  addIngredient: (recipeId: string, input: IngredientInput) => Promise<RecipeIngredient>;
  removeIngredient: (recipeId: string, ingredientId: string) => Promise<void>;

  relinkIngredient: (
    recipeId: string,
    ingredientId: string,
    productId: string,
    quantity?: { input_amount: number; input_unit: string }
  ) => Promise<void>;
  unlinkIngredient: (recipeId: string, ingredientId: string) => Promise<void>;
  updateIngredientValues: (recipeId: string, ingredientId: string, patch: Omit<IngredientPatch, 'product_id'>) => Promise<void>;
  addIngredientToLibrary: (recipeId: string, ingredientId: string) => Promise<void>;

  addPortion: (recipeId: string, input: NewPortion) => Promise<void>;
  updatePortion: (recipeId: string, portionId: string, patch: PortionPatch) => Promise<void>;
  removePortion: (recipeId: string, portionId: string) => Promise<void>;
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loaded: false,
  deletedRecipes: [],
  deletedLoaded: false,
  selected: null,
  selectedLoading: false,
  selectedError: null,

  loadRecipes: async () => {
    const { data } = await api.get<RecipeSummary[]>('/recipes');
    set({ recipes: data, loaded: true });
  },

  fetchRecipe: async (id) => {
    set({ selectedLoading: true, selectedError: null });
    try {
      const { data } = await api.get<Recipe>(`/recipes/${id}`);
      set({ selected: data, selectedLoading: false });
    } catch (err) {
      set({ selectedLoading: false, selectedError: 'Failed to load recipe.' });
      throw err;
    }
  },

  createRecipe: async (payload) => {
    const { data } = await api.post<Recipe>('/recipes', payload);
    set({ recipes: [toSummary(data), ...get().recipes], selected: data });
    return data;
  },

  updateRecipe: async (id, patch) => {
    const { data } = await api.patch<Recipe>(`/recipes/${id}`, patch);
    set({
      recipes: get().recipes.map((r) => (r.id === id ? toSummary(data) : r)),
      selected: get().selected?.id === id ? data : get().selected,
    });
    return data;
  },

  removeRecipe: async (id) => {
    const previous = get().recipes;
    set({
      recipes: previous.filter((r) => r.id !== id),
      selected: get().selected?.id === id ? null : get().selected,
    });
    try {
      await api.delete(`/recipes/${id}`);
    } catch (err) {
      set({ recipes: previous });
      throw err;
    }
  },

  loadDeletedRecipes: async () => {
    const { data } = await api.get<RecipeSummary[]>('/recipes/deleted');
    set({ deletedRecipes: data, deletedLoaded: true });
  },

  restoreRecipe: async (id) => {
    const { data } = await api.post<Recipe>(`/recipes/${id}/restore`);
    set({
      deletedRecipes: get().deletedRecipes.filter((r) => r.id !== id),
      recipes: [toSummary(data), ...get().recipes],
    });
  },

  addIngredient: async (recipeId, input) => {
    const { data } = await api.post<RecipeIngredient>(`/recipes/${recipeId}/ingredients`, input);
    await get().fetchRecipe(recipeId);
    return data;
  },

  removeIngredient: async (recipeId, ingredientId) => {
    const current = get().selected;
    if (!current || current.id !== recipeId) return;
    const ingredients = current.ingredients.filter((i) => i.id !== ingredientId).map(toIngredientInput);
    await get().updateRecipe(recipeId, { ingredients });
  },

  relinkIngredient: async (recipeId, ingredientId, productId, quantity) => {
    await api.patch(`/recipes/${recipeId}/ingredients/${ingredientId}`, {
      product_id: productId,
      ...(quantity ? { input_amount: quantity.input_amount, input_unit: quantity.input_unit } : {}),
    });
    await get().fetchRecipe(recipeId);
  },

  unlinkIngredient: async (recipeId, ingredientId) => {
    const current = get().selected;
    const ingredient = current?.ingredients.find((i) => i.id === ingredientId);
    await api.patch(`/recipes/${recipeId}/ingredients/${ingredientId}`, {
      product_id: null,
      // Unlinked ingredients only ever offer the "g" unit going forward (no
      // product left to key a household-unit conversion off of), so convert
      // the display to plain grams at the moment of unlinking.
      ...(ingredient ? { input_amount: ingredient.grams, input_unit: 'g' } : {}),
    });
    await get().fetchRecipe(recipeId);
  },

  updateIngredientValues: async (recipeId, ingredientId, patch) => {
    await api.patch(`/recipes/${recipeId}/ingredients/${ingredientId}`, patch);
    await get().fetchRecipe(recipeId);
  },

  addIngredientToLibrary: async (recipeId, ingredientId) => {
    const current = get().selected;
    if (!current || current.id !== recipeId) return;
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
    await get().relinkIngredient(recipeId, ingredientId, product.id);
  },

  addPortion: async (recipeId, input) => {
    await api.post(`/recipes/${recipeId}/portions`, input);
    await get().fetchRecipe(recipeId);
  },

  updatePortion: async (recipeId, portionId, patch) => {
    await api.patch(`/recipes/${recipeId}/portions/${portionId}`, patch);
    await get().fetchRecipe(recipeId);
  },

  removePortion: async (recipeId, portionId) => {
    await api.delete(`/recipes/${recipeId}/portions/${portionId}`);
    await get().fetchRecipe(recipeId);
  },
}));
