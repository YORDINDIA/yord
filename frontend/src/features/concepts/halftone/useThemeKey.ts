'use client';

import { useSyncExternalStore } from 'react';

/* One shared observer for every dither canvas on the page. */
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!observer) {
    observer = new MutationObserver(() => listeners.forEach((l) => l()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

/** The current `data-theme` of <html>; changes when the visitor flips the theme. */
export const useThemeKey = () =>
  useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? '',
    () => ''
  );
