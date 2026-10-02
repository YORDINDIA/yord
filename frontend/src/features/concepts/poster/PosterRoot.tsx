'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useSwatchId, type SwatchData } from './accent';

/* Owns the one CSS variable that recolours the page. `children` are server
   elements, so a swatch click re-renders this wrapper only. */
export function PosterRoot({
  swatches,
  className,
  children,
}: {
  swatches: SwatchData[];
  className: string;
  children: ReactNode;
}) {
  const id = useSwatchId();
  const active = swatches.find((s) => s.id === id) ?? swatches[0];
  return (
    <main
      className={`poster ${className}`}
      data-swatch={active.id}
      style={{ '--poster-accent': active.color, '--poster-accent-ink': active.ink } as CSSProperties}
    >
      {children}
    </main>
  );
}
