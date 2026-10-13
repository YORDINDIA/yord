'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * The hydration-safe snapshot: "no preference". Used for the server
 * render AND the hydration render, so both agree; React then swaps
 * in the real value right after hydration.
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `prefers-reduced-motion`, hydration-safe.
 *
 * `motion/react`'s own `useReducedMotion` reads `matchMedia` during
 * the first client render, which makes every component whose markup
 * branches on it a hydration mismatch for reduced-motion users. This
 * store keeps the server and hydration renders identical and updates
 * after — the same contract `chart-theme.ts` and `reactbits-theme.ts`
 * keep, and the reason it is a store instead of a `useEffect` + state
 * (a synchronous setState in an effect is a lint error here).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
