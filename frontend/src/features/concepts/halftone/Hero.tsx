'use client';

import { preload } from 'react-dom';
import { AnimatedCounter } from '@/features/ui/AnimatedCounter';
import { Arrow, ArrowLink } from './Arrow';
import { HeroStage } from './HeroStage';
import { RevealText } from './Reveal';
import { RingCta } from './RingCta';

const SLIDES = [
  '/artists/coldplay-hero.png',
  '/artists/diljit-hero.png',
  '/artists/karan-aujla-hero.png',
  '/artists/taylor-hero.png',
];

const STATS = [
  { label: 'Happy fans', value: 50000, suffix: '+', abbreviated: true },
  { label: 'Countries', value: 127, suffix: '', abbreviated: false },
  { label: 'Artists', value: 15, suffix: '+', abbreviated: false },
];

export function Hero() {
  preload(SLIDES[0], { as: 'image' });

  return (
    <section aria-labelledby="ht-hero-title" className="ht-stage ht-hero bg-scrim">
      <HeroStage sources={SLIDES} />
      <div className="ht-wrap ht-hero__grid">
        <RevealText
          as="h1"
          id="ht-hero-title"
          immediate
          className="ht-display ht-hero__title text-accent-on-media"
          segments={[{ t: 'Where Music Meets' }, { t: 'Luxury', em: true }]}
        />
        <div className="ht-hero__aside">
          <p className="ht-hero__sub">
            Premium artist merchandise and concert couture for devoted fans. Coldplay. Taylor Swift. Diljit Dosanjh. And
            more.
          </p>
          <ArrowLink href="/artists">Explore artists</ArrowLink>
        </div>
        <dl className="ht-hero__stats">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd className="ht-display">
                <AnimatedCounter value={s.value} suffix={s.suffix} formatAbbreviated={s.abbreviated} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="ht-wide ht-hero__caps">Luxury Concert Fashion</p>
        <RingCta href="/collections" label="SHOP COLLECTIONS" ariaLabel="Shop collections" className="ht-hero__ring">
          <Arrow className="ht-ring__arrow" />
        </RingCta>
      </div>
    </section>
  );
}
