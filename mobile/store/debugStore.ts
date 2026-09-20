import { create } from 'zustand';

import { DEBUG_DEFAULT } from '../constants/env';

export interface DebugState {
  debugEnabled: boolean;
  setDebugEnabled: (v: boolean) => void;
  toggleDebug: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  debugEnabled: DEBUG_DEFAULT,
  setDebugEnabled: (v) => set({ debugEnabled: v }),
  toggleDebug: () => set((s) => ({ debugEnabled: !s.debugEnabled })),
}));
