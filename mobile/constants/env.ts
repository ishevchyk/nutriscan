// export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.155:8000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
export const SECURE_STORE_REFRESH_KEY = 'nutriscan_refresh_token';

// Debug mode: logs API requests/responses and store state changes to the console.
// Override with EXPO_PUBLIC_DEBUG=true|false in .env; defaults to dev builds only.
export const DEBUG_DEFAULT = process.env.EXPO_PUBLIC_DEBUG != null
  ? process.env.EXPO_PUBLIC_DEBUG === 'true'
  : __DEV__;

// Open Food Facts attribution links (display only -- all catalog API calls go
// through our backend). Override per environment with EXPO_PUBLIC_OFF_URL.
export const OFF_WEBSITE_URL = process.env.EXPO_PUBLIC_OFF_URL ?? 'https://world.openfoodfacts.org';
export const OFF_PRODUCT_URL = `${OFF_WEBSITE_URL}/product/`;
// Shown in Profile > About when set.
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '';
