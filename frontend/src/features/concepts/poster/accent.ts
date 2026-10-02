import { useSyncExternalStore } from 'react';

export interface SwatchData {
  id: string;
  name: string;
  color: string;
  ink: string;
}

export const DEFAULT_SWATCH = 'original';
const KEY = 'yord-poster-accent';

let current: string | undefined;
const listeners = new Set<() => void>();

/* The choice is an external store so the hero swatches, the compact swatches
   and the page root stay in sync without prop drilling. localStorage is a
   convenience only: every access is guarded and the page works without it. */
export function getSwatchId(): string {
  if (current === undefined) {
    try {
      current = window.localStorage.getItem(KEY) || DEFAULT_SWATCH;
    } catch {
      current = DEFAULT_SWATCH;
    }
  }
  return current;
}

export function pickSwatch(id: string): void {
  current = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* private mode or blocked storage: keep the in-memory choice */
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSwatchId(): string {
  return useSyncExternalStore(subscribe, getSwatchId, () => DEFAULT_SWATCH);
}
