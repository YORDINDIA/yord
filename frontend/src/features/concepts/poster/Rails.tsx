import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ProductCard } from '@/features/ui/ProductCard';
import type { ArtistRail } from '@/features/concepts/loaders';
import { Arrow } from './Arrow';
import { tankerEm } from './metrics';
import { FLAT_CARD, cardProps, inkFor } from './shared';

export function Rail({ rail, side }: { rail: ArtistRail; side: 'left' | 'right' }) {
  const { artist, products } = rail;
  const color = artist.accentColor || 'var(--accent)';
  const style = {
    '--c': color,
    '--ink': inkFor(color),
    '--w': tankerEm(artist.name),
  } as CSSProperties;

  return (
    <section
      aria-labelledby={`poster-rail-${artist.handle}`}
      className="poster-rail poster-sect"
      data-side={side}
      data-tone={side === 'left' ? 'card' : 'page'}
      data-from={side === 'left' ? 'page' : 'card'}
      style={style}
    >
      <h2 id={`poster-rail-${artist.handle}`} className="poster-rail-name">
        <Link href={`/artist/${artist.handle}`} className="poster-display" data-cursor="pointer">
          {artist.name}
        </Link>
      </h2>

      <div className="poster-rail-body">
        <p className="poster-rail-meta">
          <Link href={`/artist/${artist.handle}`} className="poster-textlink" data-cursor="pointer">
            Shop all {artist.name}
            <Arrow className="poster-textlink-arrow" />
          </Link>
        </p>
        <div
          className="poster-rail-scroller"
          role="region"
          aria-label={`${artist.name} products`}
          tabIndex={0}
        >
          {products.slice(0, 4).map((p) => (
            <div key={p.id} className="poster-tile poster-invert">
              <ProductCard {...cardProps(p)} className={FLAT_CARD} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
