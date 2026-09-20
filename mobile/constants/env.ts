// export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.155:8000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export const SECURE_STORE_REFRESH_KEY = 'nutriscan_refresh_token';

// Debug mode: logs API requests/responses and store state changes to the console.
// Override with EXPO_PUBLIC_DEBUG=true|false in .env; defaults to dev builds only.
export const DEBUG_DEFAULT = process.env.EXPO_PUBLIC_DEBUG != null
  ? process.env.EXPO_PUBLIC_DEBUG === 'true'
  : __DEV__;
