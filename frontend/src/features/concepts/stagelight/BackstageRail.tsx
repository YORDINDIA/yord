'use client';

import { useRef, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, type MotionStyle } from 'framer-motion';
import type { ArtistRail } from '@/features/concepts/loaders';
import { ArrowDiag } from './Glyphs';
import { ProductGrid } from './ProductGrid';

export function BackstageRail({ rail }: { rail: ArtistRail }) {
  const { artist, products } = rail;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 1], ['-3%', '3%']);
  const color = artist.accentColor || 'var(--accent)';

  return (
    <article ref={ref} className="sl-rail" style={{ '--rail': color } as CSSProperties}>
      <div className="sl-rail__light" aria-hidden="true" />
      <motion.p className="sl-rail__giant font-[family-name:var(--font-bevellier)]" style={{ x: drift, '--chars': artist.name.length } as MotionStyle} aria-hidden="true">
        {artist.name}
      </motion.p>
      <header className="sl-rail__head">
        {artist.heroImage && (
          <span className="sl-rail__avatar sl-chamfer">
            <span className="sl-chamfer__in">
              <Image src={artist.heroImage} alt="" fill sizes="96px" className="object-cover" />
            </span>
          </span>
        )}
        <div className="sl-rail__id">
          <h3 className="font-[family-name:var(--font-bevellier)] text-text-primary">{artist.name}</h3>
          {artist.tagline && <p className="text-text-muted">{artist.tagline}</p>}
        </div>
        <Link href={`/artist/${artist.handle}`} className="sl-textlink text-accent hover:text-accent-hover">
          View artist
          <ArrowDiag className="sl-textlink__arrow" />
        </Link>
      </header>
      <ProductGrid products={products} />
    </article>
  );
}
