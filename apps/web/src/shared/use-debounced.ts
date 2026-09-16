import { useEffect, useState } from 'react';

/**
 * Hold a fast-changing value still for a moment.
 *
 * Used by the roster search: every keystroke would otherwise be a request, and
 * the server-side filter means each one is a real query rather than an array
 * filter in the browser.
 */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
