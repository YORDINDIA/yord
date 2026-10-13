'use client';

import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { AnimatedCounter } from '@/features/ui/AnimatedCounter';
import { Arrow } from './Arrow';
import { tankerEm } from './metrics';
import { HeroStack, type StackItem } from './HeroStack';
import { Swatches } from './Swatches';
import type { SwatchData } from './accent';

const STATS = [
  { value: 50000, suffix: '+', abbreviated: true, shown: '50K+', label: 'Happy fans' },
  { value: 127, suffix: '', abbreviated: false, shown: '127', label: 'Countries' },
  { value: 15, suffix: '+', abbreviated: false, shown: '15+', label: 'Artists' },
];

export function Hero({ swatches, stack }: { swatches: SwatchData[]; stack: StackItem[] }) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-labelledby="poster-hero-title"
      className="poster-hero relative flex flex-col overflow-clip bg-scrim text-text-on-media"
    >
      <div className="poster-wordmark-wrap">
        <HeroStack items={stack} />
        <p className="poster-wordmark poster-display text-text-on-media" aria-hidden="true">
          YORD
        </p>
      </div>

      <ul className="poster-pad poster-stats">
        {STATS.map((s) => (
          <li key={s.label}>
            <span
              className="poster-display poster-stat-num"
              style={{ '--mw': `${tankerEm(s.shown) + 0.05}em` } as React.CSSProperties}
              aria-hidden="true"
            >
              <AnimatedCounter
                value={s.value}
                suffix={s.suffix}
                formatAbbreviated={s.abbreviated}
                duration={reduce ? 0 : 2.4}
              />
            </span>
            <span className="sr-only">{s.shown}</span>
            <span className="poster-stat-label text-text-on-media-muted">{s.label}</span>
          </li>
        ))}
      </ul>

      <div className="poster-pad poster-micro">
        <div>
          <h1 id="poster-hero-title" className="poster-tagline">
            <span className="sr-only">YORD India: </span>Where Music Meets Luxury
          </h1>
          <p className="poster-sub text-text-on-media-muted">
            Premium artist merchandise and concert couture for devoted fans. Coldplay. Taylor Swift.
            Diljit Dosanjh. And more.
          </p>
        </div>

        <Swatches swatches={swatches} variant="hero" />

        <div className="poster-actions">
          <Link
            href="/collections"
            data-cursor="pointer"
            className="poster-display poster-cta bg-accent-on-media text-scrim hover:bg-text-on-media"
          >
            Shop collections
          </Link>
          <Link
            href="/artists"
            data-cursor="pointer"
            className="poster-textlink text-text-on-media hover:text-accent-on-media"
          >
            Explore artists
            <Arrow className="poster-textlink-arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
