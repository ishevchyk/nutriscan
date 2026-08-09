import { create } from 'zustand';
import { api } from '../lib/api';
import { useProductStore } from './productStore';
import { Group } from './types';

export type { Group };

interface GroupState {
  groups: Group[];
  loaded: boolean;
  activeGroupFilter: string | null;
  fetchGroups: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  renameGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  setActiveGroupFilter: (groupId: string | null) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  loaded: false,
  activeGroupFilter: null,

  fetchGroups: async () => {
    const { data } = await api.get<Group[]>('/groups');
    set({ groups: data, loaded: true });
  },

  createGroup: async (name) => {
    const { data } = await api.post<Group>('/groups', { name });
    set({ groups: [...get().groups, data] });
    return data;
  },

  renameGroup: async (id, name) => {
    const { data } = await api.patch<Group>(`/groups/${id}`, { name });
    set({ groups: get().groups.map((g) => (g.id === id ? data : g)) });
  },

  // Optimistic remove with rollback; on success, also strips the group's
  // badge from any cached products (they don't get refetched otherwise).
  deleteGroup: async (id) => {
    const previousGroups = get().groups;
    set({ groups: previousGroups.filter((g) => g.id !== id) });
    try {
      await api.delete(`/groups/${id}`);

      const { products } = useProductStore.getState();
      useProductStore.setState({
        products: products.map((p) => ({ ...p, groups: p.groups.filter((g) => g.id !== id) })),
      });

      if (get().activeGroupFilter === id) {
        set({ activeGroupFilter: null });
        await useProductStore.getState().loadProducts();
      }
    } catch (err) {
      set({ groups: previousGroups });
      throw err;
    }
  },

  setActiveGroupFilter: (groupId) => set({ activeGroupFilter: groupId }),
}));
