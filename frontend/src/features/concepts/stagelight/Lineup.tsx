'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDiag } from './Glyphs';

export interface LineupArtist {
  handle: string;
  name: string;
  tagline?: string;
  image: string;
}

/* Only the first few strips get an entrance; the rest are plain list items. */
const STAGGERED = 6;

export function Lineup({ artists }: { artists: LineupArtist[] }) {
  return (
    <div className="sl-lineup">
      <div className="sl-lineup__head">
        <h2 className="sl-h2 text-text-on-media">Featured Artists</h2>
        <p className="sl-lineup__count text-text-on-media-muted">
          <span className="sl-lineup__num font-[family-name:var(--font-bevellier)] text-accent-on-media">{artists.length}</span>
          on the bill
        </p>
        <Link href="/artists" className="sl-textlink text-text-on-media hover:text-accent-on-media">
          View all
          <ArrowDiag className="sl-textlink__arrow" />
        </Link>
      </div>

      <div className="sl-strips" role="region" aria-label="Artist lineup, scrolls sideways">
        <ul className="sl-strips__track">
          {artists.map((a, i) => (
            <motion.li
              key={a.handle}
              className="sl-strip"
              initial={i < STAGGERED ? { y: 32 } : false}
              whileInView={i < STAGGERED ? { y: 0 } : undefined}
              viewport={{ once: true, margin: '0px 0px -8% 0px' }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/artist/${a.handle}`} className="sl-strip__link">
                <span className="sl-strip__photo">
                  <Image src={a.image} alt={a.name} fill sizes="(max-width: 768px) 56vw, 280px" className="sl-strip__img" />
                </span>
                <span className="sl-strip__name font-[family-name:var(--font-bevellier)] text-text-on-media">{a.name}</span>
                {a.tagline && <span className="sl-strip__tag text-text-on-media-muted">{a.tagline}</span>}
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
