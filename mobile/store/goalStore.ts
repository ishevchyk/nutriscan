import { create } from 'zustand';
import { api } from '../lib/api';

export interface Goal {
  id: string;
  calories_goal: number | null;
  protein_goal: number | null;
  fat_goal: number | null;
  carbs_goal: number | null;
  updated_at: string;
}

export type GoalUpdate = Partial<
  Pick<Goal, 'calories_goal' | 'protein_goal' | 'fat_goal' | 'carbs_goal'>
>;

interface GoalState {
  goal: Goal | null;
  loaded: boolean;
  isSet: boolean;
  loading: boolean;
  error: string | null;

  loadGoal: () => Promise<void>;
  updateGoal: (patch: GoalUpdate) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set) => ({
  goal: null,
  loaded: false,
  isSet: false,
  loading: false,
  error: null,

  loadGoal: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Goal>('/goals');
      set({ goal: data, isSet: true, loaded: true, loading: false });
    } catch (err: any) {
      if (err?.response?.status === 404) {
        set({ goal: null, isSet: false, loaded: true, loading: false, error: null });
        return;
      }
      set({ loading: false, error: 'Failed to load goals.' });
      throw err;
    }
  },

  updateGoal: async (patch) => {
    const { data } = await api.patch<Goal>('/goals', patch);
    set({ goal: data, isSet: true, loaded: true });
  },
}));
