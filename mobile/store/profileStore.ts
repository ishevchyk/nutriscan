import { create } from 'zustand';
import { api } from '../lib/api';

export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  date_of_birth: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  updated_at: string | null;
}

export type ProfileUpdate = Partial<
  Pick<Profile, 'display_name' | 'date_of_birth' | 'sex' | 'height_cm' | 'weight_kg' | 'activity_level'>
>;

interface ProfileState {
  profile: Profile | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  loadProfile: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loaded: false,
  loading: false,
  error: null,

  loadProfile: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Profile>('/profile');
      set({ profile: data, loaded: true, loading: false });
    } catch (err) {
      set({ loading: false, error: 'Failed to load profile.' });
      throw err;
    }
  },

  updateProfile: async (patch) => {
    const { data } = await api.patch<Profile>('/profile', patch);
    set({ profile: data, loaded: true });
  },
}));
