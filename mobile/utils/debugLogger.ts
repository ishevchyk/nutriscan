import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { useDebugStore } from '../store/debugStore';

function isEnabled(): boolean {
  return useDebugStore.getState().debugEnabled;
}

function fullUrl(baseURL?: string, url?: string): string {
  return `${baseURL ?? ''}${url ?? ''}`;
}

export function logApiRequest(config: InternalAxiosRequestConfig): void {
  if (!isEnabled()) return;
  console.log('[API →]', config.method?.toUpperCase(), fullUrl(config.baseURL, config.url), config.data ?? '');
}

export function logApiResponse(response: AxiosResponse): void {
  if (!isEnabled()) return;
  console.log(
    '[API ←]',
    response.status,
    fullUrl(response.config.baseURL, response.config.url),
    response.data
  );
}

export function logApiError(error: AxiosError): void {
  if (!isEnabled()) return;
  console.log(
    '[API ✗]',
    error.response?.status ?? '(no response)',
    fullUrl(error.config?.baseURL, error.config?.url),
    error.response?.data ?? error.message
  );
}

// authStore's accessToken/refreshToken must never be logged in plaintext (see mobile/CLAUDE.md).
const REDACTED_KEYS = new Set(['accessToken', 'refreshToken']);

function redact(state: unknown): unknown {
  if (typeof state !== 'object' || state === null) return state;
  const entries = Object.entries(state as Record<string, unknown>).map(([key, value]) => [
    key,
    REDACTED_KEYS.has(key) && value != null ? '<redacted>' : value,
  ]);
  return Object.fromEntries(entries);
}

export function logStoreChange(name: string, prevState: unknown, nextState: unknown): void {
  if (!isEnabled()) return;
  console.log(`[store:${name}]`, { prev: redact(prevState), next: redact(nextState) });
}
