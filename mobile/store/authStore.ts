import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { SECURE_STORE_REFRESH_KEY } from '../constants/env';

function parseUserId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearTokens: () => void;
  hydrateFromStorage: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,

  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken, userId: parseUserId(accessToken) }),

  clearTokens: () => set({ accessToken: null, refreshToken: null, userId: null }),

  // Returns stored refresh token so caller can exchange it for a new access token
  hydrateFromStorage: async () => {
    const stored = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY);
    return stored ?? null;
  },
}));
