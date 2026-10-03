import { create } from 'zustand';
import { api } from '../lib/api';
import { useProductStore } from './productStore';
import { useProductFilterStore } from './productFilterStore';
import { Group } from './types';

export type { Group };

interface GroupState {
  groups: Group[];
  loaded: boolean;
  hiddenGroupIds: string[];
  manageableGroups: Group[];
  hiddenLoaded: boolean;
  fetchGroups: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  renameGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  loadHiddenGroupsScreen: () => Promise<void>;
  hideGroup: (id: string) => Promise<void>;
  unhideGroup: (id: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  loaded: false,
  hiddenGroupIds: [],
  manageableGroups: [],
  hiddenLoaded: false,

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

      useProductFilterStore.getState().dropGroup(id);
    } catch (err) {
      set({ groups: previousGroups });
      throw err;
    }
  },

  loadHiddenGroupsScreen: async () => {
    const [allResp, hiddenResp] = await Promise.all([
      api.get<Group[]>('/groups', { params: { include_hidden: true } }),
      api.get<string[]>('/groups/hidden'),
    ]);
    set({
      manageableGroups: allResp.data.filter((g) => g.is_system),
      hiddenGroupIds: hiddenResp.data,
      hiddenLoaded: true,
    });
  },

  // Optimistic with rollback, same pattern as deleteGroup; also keeps the
  // main `groups` list (used by filters/pickers elsewhere) in sync so those
  // screens don't need a refetch.
  hideGroup: async (id) => {
    const previousHiddenIds = get().hiddenGroupIds;
    const previousGroups = get().groups;
    set({
      hiddenGroupIds: [...previousHiddenIds, id],
      groups: previousGroups.filter((g) => g.id !== id),
    });
    try {
      await api.post(`/groups/${id}/hide`);
    } catch (err) {
      set({ hiddenGroupIds: previousHiddenIds, groups: previousGroups });
      throw err;
    }
  },

  unhideGroup: async (id) => {
    const previousHiddenIds = get().hiddenGroupIds;
    const previousGroups = get().groups;
    const revealed = get().manageableGroups.find((g) => g.id === id);
    set({
      hiddenGroupIds: previousHiddenIds.filter((gid) => gid !== id),
      groups:
        revealed && !previousGroups.some((g) => g.id === id)
          ? [...previousGroups, revealed]
          : previousGroups,
    });
    try {
      await api.delete(`/groups/${id}/hide`);
    } catch (err) {
      set({ hiddenGroupIds: previousHiddenIds, groups: previousGroups });
      throw err;
    }
  },
}));
