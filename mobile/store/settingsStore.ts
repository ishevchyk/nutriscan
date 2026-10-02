import { create } from 'zustand';
import { api } from '../lib/api';

export interface Settings {
  units: 'metric' | 'imperial';
  timezone: string;
  notifications_enabled: boolean;
  theme: 'light' | 'dark' | null;
  updated_at: string | null;
}

export type SettingsUpdate = Partial<
  Pick<Settings, 'units' | 'timezone' | 'notifications_enabled' | 'theme'>
>;

interface SettingsState {
  settings: Settings | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: SettingsUpdate) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loaded: false,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Settings>('/settings');
      set({ settings: data, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: 'Failed to load settings.' });
      throw err;
    }
  },

  updateSettings: async (patch) => {
    const previous = get().settings;
    if (previous) {
      set({ settings: { ...previous, ...patch } });
    }
    try {
      const { data } = await api.patch<Settings>('/settings', patch);
      set({ settings: data, loaded: true });
    } catch (err) {
      if (previous) set({ settings: previous });
      throw err;
    }
  },
}));
