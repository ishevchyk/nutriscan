import { create } from 'zustand';
import { api } from '../lib/api';
import { Meal } from './mealStore';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type SourceType = 'product' | 'meal' | 'manual';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface LogEntryMacros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface LogEntry {
  id: string;
  logged_at: string;
  meal_slot: MealSlot;
  source_type: SourceType;
  product_id: string | null;
  quantity_grams: number | null;
  meal_id: string | null;
  portion_id: string | null;
  manual_calories: number | null;
  manual_protein: number | null;
  manual_fat: number | null;
  manual_carbs: number | null;
  created_at: string;
  macros: LogEntryMacros;
  meal_ingredients: { product_id: string | null; grams: number }[] | null;
}

export type LogEntriesBySlot = Record<MealSlot, LogEntry[]>;

const EMPTY_ENTRIES_BY_SLOT: LogEntriesBySlot = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
};

export type NewProductLogEntry = {
  source_type: 'product';
  product_id: string;
  quantity_grams: number;
  meal_slot: MealSlot;
  logged_at: string;
};

export type NewMealLogEntry = {
  source_type: 'meal';
  meal_id: string;
  portion_id?: string;
  ingredient_overrides?: { product_id: string; grams: number }[];
  /** The dish's logged weight, e.g. the portion's own grams or a custom amount --
   * distinct from ingredient_overrides, which is a raw-ingredient-equivalent
   * breakdown for the macro calc. Omit to let the backend derive it. */
  quantity_grams?: number;
  meal_slot: MealSlot;
  logged_at: string;
};

export type NewManualLogEntry = {
  source_type: 'manual';
  manual_calories: number;
  manual_protein: number;
  manual_fat: number;
  manual_carbs: number;
  meal_slot: MealSlot;
  logged_at: string;
};

export type NewLogEntry = NewProductLogEntry | NewMealLogEntry | NewManualLogEntry;

export type LogEntryUpdate = Partial<{
  quantity_grams: number;
  manual_calories: number;
  manual_protein: number;
  manual_fat: number;
  manual_carbs: number;
  ingredient_overrides: { product_id: string; grams: number }[];
}>;

export interface LogTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface LogSummary {
  date: string;
  totals: LogTotals;
  goals: LogTotals | null;
}

/** Cached default per-ingredient grams (+ portions, for scaling) for a meal --
 * used only to diff a logged meal-entry's meal_ingredients for the
 * "N ingredient(s) adjusted" tag. Not the same as mealStore's `selected`. */
export interface MealIngredientDefaults {
  totalGrams: number;
  /** Mirrors the meal's cooked_weight_grams -- the reference weight portion
   * scaling uses (backend/app/nutrition.py::compute_reference_grams) when
   * set, instead of totalGrams (the raw ingredient sum). */
  cookedWeightGrams: number | null;
  ingredients: { product_id: string | null; grams: number }[];
  portions: { id: string; grams: number }[];
}

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface LogState {
  date: string;
  entriesBySlot: LogEntriesBySlot;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  summary: LogSummary | null;
  summaryLoading: boolean;

  mealDefaultsCache: Record<string, MealIngredientDefaults>;
  mealDefaultsLoading: Record<string, boolean>;

  /** Day-of-month numbers (1-31) with at least one entry, for the tracker's calendar view.
   * Scoped to one month at a time -- loggedDaysKey ("YYYY-MM") tracks which month loggedDays
   * currently holds, so switching months (or an add/remove invalidating it) triggers a refetch. */
  loggedDays: number[];
  loggedDaysKey: string | null;
  loggedDaysLoading: boolean;

  setDate: (date: string) => void;
  loadDay: (date?: string) => Promise<void>;
  fetchSummary: (date?: string) => Promise<void>;
  fetchLoggedDays: (year: number, month: number) => Promise<void>;
  addEntry: (payload: NewLogEntry) => Promise<LogEntry>;
  updateEntry: (id: string, patch: LogEntryUpdate) => Promise<LogEntry>;
  removeEntry: (id: string, slot: MealSlot) => Promise<void>;
  ensureMealDefaults: (mealId: string) => Promise<MealIngredientDefaults>;
}

export const useLogStore = create<LogState>((set, get) => ({
  date: toISODate(new Date()),
  entriesBySlot: EMPTY_ENTRIES_BY_SLOT,
  loaded: false,
  loading: false,
  error: null,
  summary: null,
  summaryLoading: false,

  mealDefaultsCache: {},
  mealDefaultsLoading: {},

  loggedDays: [],
  loggedDaysKey: null,
  loggedDaysLoading: false,

  setDate: (date) => {
    set({ date });
    get().loadDay(date);
    get().fetchSummary(date);
  },

  loadDay: async (date) => {
    const target = date ?? get().date;
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<LogEntriesBySlot>('/log', { params: { date: target } });
      set({ entriesBySlot: data, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: 'Failed to load log entries.' });
      throw err;
    }
  },

  fetchSummary: async (date) => {
    const target = date ?? get().date;
    set({ summaryLoading: true });
    try {
      const { data } = await api.get<LogSummary>('/log/summary', { params: { date: target } });
      set({ summary: data, summaryLoading: false });
    } catch (err) {
      set({ summaryLoading: false });
      throw err;
    }
  },

  fetchLoggedDays: async (year, month) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (get().loggedDaysKey === key || get().loggedDaysLoading) return;
    set({ loggedDaysLoading: true });
    try {
      const { data } = await api.get<{ days: number[] }>('/log/logged-days', { params: { year, month } });
      set({ loggedDays: data.days, loggedDaysKey: key, loggedDaysLoading: false });
    } catch (err) {
      set({ loggedDaysLoading: false });
      throw err;
    }
  },

  addEntry: async (payload) => {
    const { data } = await api.post<LogEntry>('/log', payload);
    await get().loadDay();
    await get().fetchSummary();
    set({ loggedDaysKey: null });
    return data;
  },

  updateEntry: async (id, patch) => {
    const { data } = await api.patch<LogEntry>(`/log/${id}`, patch);
    await get().loadDay();
    await get().fetchSummary();
    return data;
  },

  removeEntry: async (id, slot) => {
    const previous = get().entriesBySlot;
    set({
      entriesBySlot: {
        ...previous,
        [slot]: previous[slot].filter((e) => e.id !== id),
      },
      loggedDaysKey: null,
    });
    try {
      await api.delete(`/log/${id}`);
      get().fetchSummary();
    } catch (err) {
      set({ entriesBySlot: previous });
      throw err;
    }
  },

  ensureMealDefaults: async (mealId) => {
    const existing = get().mealDefaultsCache[mealId];
    if (existing) return existing;
    if (get().mealDefaultsLoading[mealId]) {
      // Already in flight -- caller's effect will re-run once it lands.
      return { totalGrams: 0, cookedWeightGrams: null, ingredients: [], portions: [] };
    }
    set({ mealDefaultsLoading: { ...get().mealDefaultsLoading, [mealId]: true } });
    try {
      const { data } = await api.get<Meal>(`/meals/${mealId}`);
      const defaults: MealIngredientDefaults = {
        totalGrams: data.ingredients.reduce((sum, i) => sum + i.grams, 0),
        cookedWeightGrams: data.cooked_weight_grams,
        ingredients: data.ingredients.map((i) => ({ product_id: i.product_id, grams: i.grams })),
        portions: data.portions.map((p) => ({ id: p.id, grams: p.grams })),
      };
      set({
        mealDefaultsCache: { ...get().mealDefaultsCache, [mealId]: defaults },
        mealDefaultsLoading: { ...get().mealDefaultsLoading, [mealId]: false },
      });
      return defaults;
    } catch (err) {
      set({ mealDefaultsLoading: { ...get().mealDefaultsLoading, [mealId]: false } });
      throw err;
    }
  },
}));
