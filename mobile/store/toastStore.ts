import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

type ToastInput = Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number };

interface ToastState {
  toast: Toast | null;
  /** Shows a toast, replacing any current one (only one at a time). */
  showToast: (input: ToastInput) => void;
  dismissToast: (id?: number) => void;
}

const DEFAULT_DURATION_MS = 5000;
let nextId = 1;

/** Global so a toast can outlive the screen that raised it (e.g. "Deleted ...
 * UNDO" shown after navigating back to the list). Rendered by <ToastHost/>. */
export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  showToast: (input) =>
    set({ toast: { durationMs: DEFAULT_DURATION_MS, ...input, id: nextId++ } }),
  // With an id, only dismisses that toast -- a stale auto-dismiss timer must
  // not close the toast that replaced it.
  dismissToast: (id) => {
    if (id == null || get().toast?.id === id) set({ toast: null });
  },
}));

export const showToast = (input: ToastInput) => useToastStore.getState().showToast(input);
