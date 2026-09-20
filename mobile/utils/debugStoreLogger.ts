import type { StoreApi, UseBoundStore } from 'zustand';

import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import { useGroupStore } from '../store/groupStore';
import { useLogStore } from '../store/logStore';
import { useMealStore } from '../store/mealStore';
import { usePickerStore } from '../store/pickerStore';
import { useProductStore } from '../store/productStore';
import { useUnitConversionStore } from '../store/unitConversionStore';
import { logStoreChange } from './debugLogger';

const stores: Record<string, UseBoundStore<StoreApi<unknown>>> = {
  auth: useAuthStore,
  meal: useMealStore,
  product: useProductStore,
  goal: useGoalStore,
  group: useGroupStore,
  log: useLogStore,
  unitConversion: useUnitConversionStore,
  picker: usePickerStore,
};

let initialized = false;

// Subscribes to every store's changes for debug-mode console logging. Safe to call once at app
// startup; subscribing doesn't touch the stores themselves so no store file needs to change.
export function initStoreDebugLogging(): void {
  if (initialized) return;
  initialized = true;
  Object.entries(stores).forEach(([name, store]) => {
    store.subscribe((state, prevState) => logStoreChange(name, prevState, state));
  });
}
