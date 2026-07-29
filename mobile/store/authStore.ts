import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { SECURE_STORE_REFRESH_KEY } from '../constants/env';
import { authApi } from '../lib/api';

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
  hydrateFromStorage: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,

  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken, userId: parseUserId(accessToken) }),

  clearTokens: () => set({ accessToken: null, refreshToken: null, userId: null }),

  // Exchanges a persisted refresh token for a fresh session on app startup.
  // Returns true if the session was restored, false if the user still needs to log in.
  hydrateFromStorage: async () => {
    const stored = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY);
    if (!stored) return false;

    try {
      const { data } = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refresh_token: stored }
      );
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, data.refresh_token);
      set({ accessToken: data.access_token, refreshToken: data.refresh_token, userId: parseUserId(data.access_token) });
      return true;
    } catch {
      await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
      set({ accessToken: null, refreshToken: null, userId: null });
      return false;
    }
  },
}));
