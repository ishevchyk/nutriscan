import axios from 'axios';
import { create } from 'zustand';

import { api } from '../lib/api';
import { Group } from './types';

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  disabled_at: string | null;
  sign_in_methods: string[];
}

export interface AdminStats {
  users_total: number;
  users_active: number;
  users_disabled: number;
  admins: number;
  signups_last_7_days: number;
  signups_last_30_days: number;
  products_total: number;
  meals_total: number;
  log_entries_total: number;
}

interface AdminState {
  // Which user the cached role belongs to, so a different account logging in
  // on the same device never inherits the previous one's admin access.
  roleUserId: string | null;
  isAdmin: boolean;
  stats: AdminStats | null;
  systemGroups: Group[];

  loadRole: (userId: string) => Promise<void>;
  loadStats: () => Promise<void>;
  loadSystemGroups: () => Promise<void>;
  createSystemGroup: (name: string) => Promise<void>;
  renameSystemGroup: (id: string, name: string) => Promise<void>;
  searchUsers: (q: string) => Promise<{ items: AdminUser[]; total: number }>;
  updateUser: (id: string, patch: { role?: 'user' | 'admin'; disabled?: boolean }) => Promise<AdminUser>;
  deleteUser: (id: string) => Promise<void>;
}

export function adminErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  roleUserId: null,
  isAdmin: false,
  stats: null,
  systemGroups: [],

  loadRole: async (userId) => {
    try {
      const { data } = await api.get<{ user: { role: string } }>('/me');
      set({ roleUserId: userId, isAdmin: data.user.role === 'admin' });
    } catch {
      // Leave the Admin section hidden if the role can't be confirmed.
      set({ roleUserId: userId, isAdmin: false });
    }
  },

  loadStats: async () => {
    const { data } = await api.get<AdminStats>('/admin/stats');
    set({ stats: data });
  },

  loadSystemGroups: async () => {
    const { data } = await api.get<Group[]>('/groups', { params: { include_hidden: true } });
    set({ systemGroups: data.filter((g) => g.is_system) });
  },

  createSystemGroup: async (name) => {
    const { data } = await api.post<Group>('/admin/groups', { name });
    set({ systemGroups: [...get().systemGroups, data] });
  },

  renameSystemGroup: async (id, name) => {
    const { data } = await api.patch<Group>(`/admin/groups/${id}`, { name });
    set({ systemGroups: get().systemGroups.map((g) => (g.id === id ? data : g)) });
  },

  searchUsers: async (q) => {
    const { data } = await api.get<{ items: AdminUser[]; total: number }>('/admin/users', {
      params: { q: q || undefined, limit: 50 },
    });
    return data;
  },

  updateUser: async (id, patch) => {
    const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, patch);
    return data;
  },

  deleteUser: async (id) => {
    await api.delete(`/admin/users/${id}`);
  },
}));
