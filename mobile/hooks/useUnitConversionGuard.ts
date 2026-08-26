import { useState } from 'react';
import { isAxiosError } from 'axios';

import { useUnitConversionStore } from '../store/unitConversionStore';

type PendingPrompt = {
  productId: string;
  productName: string;
  unit: string;
  resolve: (gramsPerUnit: number | null) => void;
};

type GuardedResult<T> = { ok: true; value: T } | { ok: false };

function isMissingConversion(err: unknown): boolean {
  return (
    isAxiosError(err) &&
    err.response?.status === 422 &&
    (err.response.data as any)?.detail?.error_code === 'unit_conversion_missing'
  );
}

/** Central orchestration for "How much does 1 [unit] of [product] weigh?" —
 * shared between the recipe edit screen (reactive: catches the backend's
 * unit_conversion_missing 422 and retries) and the add-recipe builder
 * (proactive: no recipe exists yet to call, so it checks the saved-conversion
 * cache directly and prompts before adding a household-unit ingredient). */
export function useUnitConversionGuard() {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const saveConversion = useUnitConversionStore((s) => s.saveConversion);

  function promptForConversion(productId: string, productName: string, unit: string): Promise<number | null> {
    return new Promise((resolve) => {
      setPending({ productId, productName, unit, resolve });
    });
  }

  async function onResolve(grams: number) {
    if (!pending) return;
    const { productId, unit, resolve } = pending;
    setPending(null);
    const conversion = await saveConversion(productId, unit, grams);
    resolve(conversion.grams_per_unit);
  }

  function onCancel() {
    pending?.resolve(null);
    setPending(null);
  }

  /** Reactive: runs `action`; on unit_conversion_missing, prompts, saves the
   * conversion, and retries `action` once. Returns { ok: false } if the user
   * cancels the prompt or the retry still fails.
   *
   * `action` can take a real network round-trip to fail, so the caller should
   * show its own loading state for the duration of this call rather than
   * closing/hiding anything up front — there's nothing to see happen until
   * this settles. `onBeforePrompt` (e.g. closing a sheet that's still open)
   * fires only once we actually know a prompt is needed, right before the
   * 350ms pause that lets that sheet's close animation finish so the new
   * modal doesn't try to present over a live one. */
  async function runGuarded<T>(
    action: () => Promise<T>,
    ctx: { productId: string; productName: string; unit: string },
    options?: { onBeforePrompt?: () => void }
  ): Promise<GuardedResult<T>> {
    try {
      return { ok: true, value: await action() };
    } catch (err) {
      if (!isMissingConversion(err)) throw err;
      options?.onBeforePrompt?.();
      await new Promise((resolve) => setTimeout(resolve, 350));
      const gramsPerUnit = await promptForConversion(ctx.productId, ctx.productName, ctx.unit);
      if (gramsPerUnit == null) return { ok: false };
      try {
        return { ok: true, value: await action() };
      } catch {
        return { ok: false };
      }
    }
  }

  /** Proactive: resolves grams-per-unit for a product+unit from the saved
   * conversion cache, prompting if it isn't known yet. Returns null on cancel. */
  async function resolveGramsPerUnit(productId: string, productName: string, unit: string): Promise<number | null> {
    const store = useUnitConversionStore.getState();
    const cached = store.getGramsPerUnit(productId, unit);
    if (cached != null) return cached;
    await store.ensureLoaded(productId);
    const afterLoad = useUnitConversionStore.getState().getGramsPerUnit(productId, unit);
    if (afterLoad != null) return afterLoad;
    return promptForConversion(productId, productName, unit);
  }

  return { pending, onResolve, onCancel, runGuarded, resolveGramsPerUnit };
}
