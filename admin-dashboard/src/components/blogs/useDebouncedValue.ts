'use client';

import { useEffect, useState } from 'react';

/**
 * Trailing debounce for a value that drives an expensive render (the article
 * preview sanitizes and re-parses the whole body on every change).
 *
 * The state starts as `value`, so the first render — server and client — shows
 * the real content rather than an empty preview, and no effect is needed to
 * seed it. Only subsequent changes wait for `delayMs` of quiet.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
