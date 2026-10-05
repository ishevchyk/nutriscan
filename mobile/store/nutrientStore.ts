import { create } from 'zustand';
import { api } from '../lib/api';

export interface Nutrient {
  code: string;
  name: string;
  unit: string;
  category: 'fat' | 'carbohydrate' | 'vitamin' | 'mineral' | 'other';
  parent_code: string | null;
  nrv: number | null;
  sort_order: number;
}

interface NutrientState {
  nutrients: Nutrient[];
  loaded: boolean;
  loadNutrients: () => Promise<void>;
}

/** Reference table (labels, units, EU NRVs) for extended nutrients. Static, so
 * fetched once per session. */
export const useNutrientStore = create<NutrientState>((set) => ({
  nutrients: [],
  loaded: false,

  loadNutrients: async () => {
    const { data } = await api.get<Nutrient[]>('/nutrients');
    set({ nutrients: data, loaded: true });
  },
}));
