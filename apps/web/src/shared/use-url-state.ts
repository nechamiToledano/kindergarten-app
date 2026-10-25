import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Screen state that lives in the address bar.
 *
 * Filters, search text, page and tab are kept in the query string instead of
 * component state, so they belong to the history entry: opening a child from a
 * filtered roster and coming back (back button, `BackLink`, or the browser's own)
 * lands on the same filtered, same-page table. It also survives a reload.
 *
 * Values equal to their default are left out of the URL to keep it clean. Writes
 * replace the current entry rather than pushing, so typing in a search box does
 * not leave a history stop per keystroke. All changes for one interaction go in a
 * single `patch` call — two calls in the same tick would each start from the
 * same snapshot and the first would be lost.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = { ...defaults } as Record<string, string>;
  for (const key of Object.keys(defaults)) {
    const value = params.get(key);
    if (value !== null) values[key] = value;
  }

  const patch = useCallback(
    (changes: Partial<T>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === defaults[key]) next.delete(key);
            else next.set(key, value as string);
          }
          return next;
        },
        { replace: true },
      );
    },
    // `defaults` is a fresh object literal each render; its content is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams, JSON.stringify(defaults)],
  );

  return [values as T, patch] as const;
}
