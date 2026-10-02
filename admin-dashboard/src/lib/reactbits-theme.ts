'use client';

import { useSyncExternalStore } from 'react';

/**
 * Bridge between the admin's CSS-variable token system and the
 * vendored ReactBits components, which take literal colour strings
 * (Aurora's WebGL uniforms, GlareHover's glare gradient, BorderGlow's
 * mesh colours).
 *
 * Values are read from the live stylesheet, so both themes resolve
 * without duplicating the palette in TypeScript, and the store
 * re-reads whenever the theme toggle flips `data-theme` on `<html>`.
 *
 * Why a cached `useSyncExternalStore` store instead of reading
 * `getComputedStyle` during render: the server cannot know the
 * theme, so the server AND the hydration render must agree on one
 * frozen snapshot (`SERVER_COLORS`, empty strings) — consumers only
 * touch these colours in ways that tolerate empty values there.
 * React then swaps in the resolved tokens right after hydration.
 * This is the same contract `chart-theme.ts` keeps.
 */

export interface ReactBitsColors {
  /** Brand accent: #f3b13f (dark) / #8a6100 (light). */
  accent: string;
  /** Card surface: #12151d (dark) / #ffffff (light). Resolved, not
   *  a var, because BorderGlow branches on whether the surface is
   *  light or dark. */
  surface: string;
  blue: string;
  emerald: string;
  violet: string;
  rose: string;
  cyan: string;
  amber: string;
}

/** The hydration-safe snapshot: empty colours, no theme knowledge. */
const SERVER_COLORS: ReactBitsColors = {
  accent: '',
  surface: '',
  blue: '',
  emerald: '',
  violet: '',
  rose: '',
  cyan: '',
  amber: '',
};

function readToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function resolveColors(): ReactBitsColors {
  if (typeof document === 'undefined') return SERVER_COLORS;
  return {
    accent: readToken('--accent'),
    surface: readToken('--surface-card'),
    blue: readToken('--tone-blue'),
    emerald: readToken('--tone-emerald'),
    violet: readToken('--tone-violet'),
    rose: readToken('--tone-rose'),
    cyan: readToken('--tone-cyan'),
    amber: readToken('--tone-amber'),
  };
}

/**
 * `getSnapshot` must return the *same object* until something
 * actually changed, or React re-renders forever. The cache is
 * dropped on a theme flip.
 */
let cachedColors: ReactBitsColors | null = null;

function getSnapshot(): ReactBitsColors {
  if (!cachedColors) cachedColors = resolveColors();
  return cachedColors;
}

function getServerSnapshot(): ReactBitsColors {
  return SERVER_COLORS;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  // `<html data-theme>` is written by the pre-paint script in
  // `layout.tsx` and by `ThemeToggle`; watching the attribute is the
  // whole theme contract.
  const observer = new MutationObserver(() => {
    cachedColors = null;
    onStoreChange();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

/** Live token colours for the current theme. */
export function useReactBitsColors(): ReactBitsColors {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * `#f3b13f` → `40 85 55`, the HSL triplet BorderGlow's `glowColor`
 * expects (it parses the three numbers out of the string).
 */
export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return '40 80 60';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0 ${Math.round(l * 100)}`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return `${Math.round(h)} ${Math.round(s * 100)} ${Math.round(l * 100)}`;
}
