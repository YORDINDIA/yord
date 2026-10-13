'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { getImageProps } from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { AnimatedCounter } from '@/features/ui/AnimatedCounter';
import { Numeral } from './Chapter';
import { ArrowDiag } from './Glyphs';
import { StageRig } from './StageRig';

const EASE = [0.22, 1, 0.36, 1] as const;
const ART = '/concepts/stagelight';

const STATS = [
  { label: 'Happy fans', node: <AnimatedCounter value={50000} formatAbbreviated suffix="+" /> },
  { label: 'Countries', node: <AnimatedCounter value={127} /> },
  { label: 'Artists', node: <AnimatedCounter value={15} suffix="+" /> },
];

function Backdrop() {
  const shared = { alt: '', fill: true, sizes: '100vw', priority: true, fetchPriority: 'high' } as const;
  const wide = getImageProps({ ...shared, src: `${ART}/hero-stage.jpg` }).props;
  const tall = getImageProps({ ...shared, src: `${ART}/hero-stage-m.jpg` }).props;
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide.srcSet} sizes={wide.sizes} />
      <img {...tall} alt="" className="sl-hero__img" />
    </picture>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  /* The far plate lags the most; the rig, nearer, moves faster. */
  const plateY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const rigY = useTransform(scrollYProgress, [0, 1], ['0%', '7%']);

  return (
    <section ref={ref} id="opening" aria-label="Opening" data-tone="stage" className="sl-hero sl-grain bg-scrim text-text-on-media">
      <div className="sl-hero__frame" aria-hidden="true">
        <motion.div className="sl-hero__plate" style={{ y: plateY }}>
          <Backdrop />
        </motion.div>
      </div>
      <div className="sl-hero__shade" aria-hidden="true" />
      <motion.div className="sl-hero__rig" style={{ y: rigY }}>
        <StageRig className="sl-hero__rigsvg" />
      </motion.div>

      <div className="sl-hero__grid">
        <div className="sl-gutter sl-hero__gutter">
          <Numeral n="01" title="Opening" />
        </div>
        <div className="sl-hero__body">
          <h1 className="sl-hero__title">
            <motion.span className="block" initial={{ y: 28 }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE }}>
              Where Music
            </motion.span>
            <motion.span className="block" initial={{ y: 28 }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }}>
              Meets Luxury
            </motion.span>
          </h1>
          <div className="sl-hero__row">
            <motion.div className="sl-hero__copy" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }}>
              <p className="sl-hero__sub text-text-on-media-muted">
                Premium artist merchandise and concert couture for devoted fans. Coldplay. Taylor Swift. Diljit Dosanjh. And more.
              </p>
              <div className="sl-hero__actions">
                <Link href="/collections" className="sl-cta bg-accent-on-media text-scrim hover:bg-text-on-media">
                  SHOP COLLECTIONS
                </Link>
                <Link href="/artists" className="sl-textlink text-text-on-media hover:text-accent-on-media">
                  Explore artists
                  <ArrowDiag className="sl-textlink__arrow" />
                </Link>
              </div>
            </motion.div>
            <dl className="sl-hero__stats">
              {STATS.map((s) => (
                <div key={s.label} className="sl-stat">
                  <dt className="sl-stat__label text-text-on-media-muted">{s.label}</dt>
                  <dd className="sl-stat__fig font-[family-name:var(--font-bevellier)] text-text-on-media">{s.node}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
