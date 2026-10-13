'use client';

import { useId, type CSSProperties } from 'react';
import { pickSwatch, useSwatchId, type SwatchData } from './accent';

export function Swatches({ swatches, variant }: { swatches: SwatchData[]; variant: 'hero' | 'inline' }) {
  const labelId = useId();
  const id = useSwatchId();
  const active = swatches.find((s) => s.id === id) ?? swatches[0];

  return (
    <div role="group" aria-labelledby={labelId} className="poster-swatches" data-variant={variant}>
      <p id={labelId} className="poster-swatches-label">
        Pick an artist, the page takes their colors
      </p>
      <div className="poster-swatches-row">
        {swatches.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === active.id}
            aria-label={s.name}
            title={s.name}
            data-cursor="pointer"
            className="poster-swatch"
            style={{ '--sw': s.color } as CSSProperties}
            onClick={() => pickSwatch(s.id)}
          />
        ))}
      </div>
      <p className="poster-swatches-name" aria-live="polite">
        {active.name}
      </p>
    </div>
  );
}
