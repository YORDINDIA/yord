/**
 * Design concepts are visible in development and hidden in production unless
 * NEXT_PUBLIC_SHOW_CONCEPTS=1. Both vars are inlined at build time, so this
 * same check is safe in server layouts and in client components.
 */
export const conceptsEnabled =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_CONCEPTS === '1';

export const CONCEPTS = [
  { slug: 'poster', letter: 'A', name: 'Poster', href: '/concepts/poster' },
  { slug: 'halftone', letter: 'B', name: 'Halftone', href: '/concepts/halftone' },
  { slug: 'stagelight', letter: 'C', name: 'Stagelight', href: '/concepts/stagelight' },
] as const;
