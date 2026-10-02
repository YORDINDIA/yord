'use client';

import { useSyncExternalStore } from 'react';

/**
 * The chart set reads its colours from the live cascade instead of hardcoding
 * hues, so the eight `--chart-*` tokens (and the grid / axis / cursor tokens)
 * stay the single source of truth in both themes.
 *
 * Why `useSyncExternalStore` and not `useEffect(() => setTheme(...))`: the
 * effect form is a `react-hooks/set-state-in-effect` lint error, and this is
 * exactly the case the hook exists for — a browser-only value with a known
 * server snapshot. React renders `DARK_DEFAULTS` on the server *and* on the
 * hydration pass (so there is no mismatch), then swaps in the resolved tokens.
 */

/** Tone names, index-aligned with the CSS ramp (`--chart-1` … `--chart-8`). */
export const CHART_TONES = [
  'saffron',
  'blue',
  'emerald',
  'violet',
  'rose',
  'amber',
  'cyan',
  'indigo',
] as const;

export type ChartTone = (typeof CHART_TONES)[number];

export interface ChartTheme {
  /** Resolved `--chart-1` … `--chart-8`, in `CHART_TONES` order. */
  palette: string[];
  grid: string;
  axis: string;
  cursor: string;
  surface: string;
  border: string;
  textStrong: string;
  textSubtle: string;
}

/**
 * The dark block of `globals.css`, copied. Dark is the product default, so a
 * server-rendered chart that is never hydrated (or a chart inside a
 * `prefers-reduced-*` snapshot test) still looks right.
 */
const DARK_DEFAULTS: ChartTheme = {
  palette: ['#f3b13f', '#5aa7ff', '#4fd2b2', '#a78bfa', '#f472b6', '#fbbf24', '#22d3ee', '#818cf8'],
  grid: 'rgba(255, 255, 255, 0.06)',
  axis: '#7d8695',
  cursor: 'rgba(255, 255, 255, 0.06)',
  surface: '#12151d',
  border: 'rgba(255, 255, 255, 0.08)',
  textStrong: '#f2f4f8',
  textSubtle: '#7d8695',
};

const TOKEN_VARS: Record<Exclude<keyof ChartTheme, 'palette'>, string> = {
  grid: '--chart-grid',
  axis: '--chart-axis',
  cursor: '--chart-cursor',
  surface: '--surface-card',
  border: '--border-default',
  textStrong: '--text-strong',
  textSubtle: '--text-subtle',
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

/**
 * Reads the resolved tokens off `<html>`. Only call from an effect, an event
 * handler, or the `useSyncExternalStore` snapshot below — never during a
 * server render.
 */
export function resolveChartTheme(): ChartTheme {
  if (typeof document === 'undefined') return DARK_DEFAULTS;

  const styles = getComputedStyle(document.documentElement);
  return {
    palette: DARK_DEFAULTS.palette.map((fallback, index) => readVar(styles, `--chart-${index + 1}`, fallback)),
    grid: readVar(styles, TOKEN_VARS.grid, DARK_DEFAULTS.grid),
    axis: readVar(styles, TOKEN_VARS.axis, DARK_DEFAULTS.axis),
    cursor: readVar(styles, TOKEN_VARS.cursor, DARK_DEFAULTS.cursor),
    surface: readVar(styles, TOKEN_VARS.surface, DARK_DEFAULTS.surface),
    border: readVar(styles, TOKEN_VARS.border, DARK_DEFAULTS.border),
    textStrong: readVar(styles, TOKEN_VARS.textStrong, DARK_DEFAULTS.textStrong),
    textSubtle: readVar(styles, TOKEN_VARS.textSubtle, DARK_DEFAULTS.textSubtle),
  };
}

/**
 * `getSnapshot` must return the *same object* until something actually
 * changed, or React re-renders forever. The cache is dropped on a theme flip.
 */
let cachedTheme: ChartTheme | null = null;

function getSnapshot(): ChartTheme {
  if (!cachedTheme) cachedTheme = resolveChartTheme();
  return cachedTheme;
}

function getServerSnapshot(): ChartTheme {
  return DARK_DEFAULTS;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {};

  // `next-themes` is not in the admin: `<html data-theme>` is written by the
  // pre-paint script in `layout.tsx` and by `ThemeToggle`. Watching the
  // attribute is therefore the whole contract.
  const observer = new MutationObserver(() => {
    cachedTheme = null;
    onStoreChange();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return () => observer.disconnect();
}

/** Live chart tokens for the current theme. */
export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const SHORT_HEX = /^#([\da-f])([\da-f])([\da-f])$/i;
const LONG_HEX = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})(?:[\da-f]{2})?$/i;

/**
 * `withAlpha('#f3b13f', 0.3)` → `rgba(243, 177, 63, 0.3)`.
 *
 * A gradient stop cannot use `color-mix()` reliably across the browsers this
 * admin supports and cannot hold a CSS variable either (Recharts writes the
 * stop as an attribute), so the palette colour is converted once per chart.
 * Anything that is not a hex colour — a `var(...)`, an `rgba(...)` — is handed
 * back untouched rather than turned into a broken `rgba(NaN, …)`.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const match = SHORT_HEX.exec(hex) ?? LONG_HEX.exec(hex);
  if (!match) return color;

  const [r, g, b] = match.slice(1).map((part) => parseInt(part.length === 1 ? part + part : part, 16));
  const resolvedAlpha = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;

  return `rgba(${r}, ${g}, ${b}, ${resolvedAlpha})`;
}
