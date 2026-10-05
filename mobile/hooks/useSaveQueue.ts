import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVED_VISIBLE_MS = 1400;

/**
 * Runs save tasks one at a time (never parallel requests) and exposes a
 * status for the header indicator. `run` never throws: a failed task flips the
 * status to 'error' and is kept so `retry` can run it again.
 */
export function useSaveQueue() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const active = useRef(0);
  const failed = useRef<(() => Promise<unknown>) | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const safeSetStatus = useCallback((next: SaveStatus) => {
    if (mounted.current) setStatus(next);
  }, []);

  const run = useCallback(
    <T,>(task: () => Promise<T>): Promise<T | undefined> => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      active.current += 1;
      safeSetStatus('saving');

      const result = chain.current.then(async () => {
        try {
          const value = await task();
          if (failed.current === task) failed.current = null;
          return value;
        } catch {
          failed.current = task;
          return undefined;
        } finally {
          active.current -= 1;
          if (active.current === 0) {
            if (failed.current) {
              safeSetStatus('error');
            } else {
              safeSetStatus('saved');
              savedTimer.current = setTimeout(() => safeSetStatus('idle'), SAVED_VISIBLE_MS);
            }
          }
        }
      });
      chain.current = result;
      return result as Promise<T | undefined>;
    },
    [safeSetStatus]
  );

  const retry = useCallback(() => {
    const task = failed.current;
    if (task) void run(task);
  }, [run]);

  /** Resolves once everything queued so far has settled. */
  const idle = useCallback(() => chain.current.then(() => undefined), []);

  const hasFailed = useCallback(() => failed.current != null, []);

  return { status, run, retry, idle, hasFailed };
}
