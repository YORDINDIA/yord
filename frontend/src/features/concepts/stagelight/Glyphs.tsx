import type { ReactNode } from 'react';

/* Marks built on the 24 grid of the YORD diamond `M12 2L22 12L12 22L2 12Z`.
   The value glyphs share one construction: the diamond opened at its top
   vertex with a small stone set in the gap, plus one mark inside. */

export function ArrowDiag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" aria-hidden="true" focusable="false">
      <path d="M3.5 12.5L12 4M5.5 3.8H12.2V10.5" />
    </svg>
  );
}

const STONE = 'M12 0.6L13.6 2.2L12 3.8L10.4 2.2Z';
const OPEN_DIAMOND = 'M10.2 3.8L2 12L12 22L22 12L13.8 3.8';

const INNER: Record<string, ReactNode> = {
  quality: <path d="M12 8L16 12L12 16L8 12Z" />,
  made: (
    <>
      <path d="M8.6 10.4L10.2 12L8.6 13.6L7 12Z" fill="currentColor" />
      <path d="M15.4 10.4L17 12L15.4 13.6L13.8 12Z" fill="currentColor" />
    </>
  ),
  delivery: <path d="M7.5 12H16.5M13.5 9L16.5 12L13.5 15" />,
  first: <path d="M12 8L16 12L12 16L8 12Z" fill="currentColor" />,
};

export type ValueGlyphKind = keyof typeof INNER;

export function ValueGlyph({ kind, className }: { kind: ValueGlyphKind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" aria-hidden="true" focusable="false">
      <path d={OPEN_DIAMOND} />
      <path d={STONE} fill="currentColor" stroke="none" />
      {INNER[kind]}
    </svg>
  );
}
