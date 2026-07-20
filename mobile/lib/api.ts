import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL, SECURE_STORE_REFRESH_KEY } from '../constants/env';
import { useAuthStore } from '../store/authStore';

// Bare instance used for auth endpoints (no interceptors — avoids infinite refresh loops)
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Main intercepted instance for all authenticated requests
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processPendingQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const storedRefresh = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY);
      if (!storedRefresh) throw new Error('No refresh token');

      const { data } = await authApi.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refresh_token: storedRefresh }
      );

      useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, data.refresh_token);

      processPendingQueue(null, data.access_token);
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processPendingQueue(refreshError, null);
      useAuthStore.getState().clearTokens();
      await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
