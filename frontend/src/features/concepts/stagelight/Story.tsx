'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDiag, ValueGlyph, type ValueGlyphKind } from './Glyphs';

const VALUES: Array<{ kind: ValueGlyphKind; title: string; text: string }> = [
  { kind: 'quality', title: 'Premium Quality', text: 'Every piece crafted with the finest materials and attention to detail.' },
  { kind: 'made', title: 'Fan Made', text: 'Artist-inspired designs made by fans, for fans.' },
  { kind: 'delivery', title: 'Pan-India Delivery', text: 'Fast, secure shipping to every corner of the country.' },
  { kind: 'first', title: 'Fan-First', text: 'Designed by fans, for fans. Every purchase celebrates your passion.' },
];

/* Y on a 100 grid: arms meet at (50,53), stem to (50,83). The box is 60 x 66,
   centred on (50,50) so the mark sits dead centre in the frame. */
const Y_PATH = 'M20 17L50 53L80 17M50 53V83';

function Monogram() {
  return (
    <svg className="sl-monogram" viewBox="0 0 100 100" aria-hidden="true" focusable="false" fill="none" strokeLinejoin="miter">
      <path d={Y_PATH} stroke="var(--scrim)" strokeOpacity="0.55" strokeWidth="5.5" />
      <path d={Y_PATH} stroke="var(--text-on-media)" strokeOpacity="0.28" strokeWidth="2.4" />
      <motion.path
        d={Y_PATH}
        stroke="var(--accent-on-media)"
        strokeWidth="2.4"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export function Story() {
  return (
    <div className="sl-story">
      <div className="sl-story__lead">
        <div className="sl-story__text">
          <h2 className="sl-h2 sl-story__title text-text-on-media">
            <span className="block">More Than</span>
            <span className="block">Merchandise</span>
          </h2>
          <p className="text-text-on-media-muted">
            YORD India was born from a simple belief: concert merchandise should be as memorable as the music itself. We craft
            premium apparel that captures the magic of live performances and transforms it into wearable art.
          </p>
          <p className="text-text-on-media-muted">
            From the electric energy of a Coldplay show to the poetic grace of Taylor Swift, from the vibrant celebration of
            Diljit Dosanjh, each piece tells a story of unforgettable moments shared between artists and their devoted fans.
          </p>
          <p className="sl-story__pull font-[family-name:var(--font-bevellier)] text-accent-on-media">Where Every Thread Tells a Story</p>
          <div className="sl-story__foot">
            <Link href="/about" className="sl-textlink text-text-on-media hover:text-accent-on-media">
              DISCOVER OUR STORY
              <ArrowDiag className="sl-textlink__arrow" />
            </Link>
            <span className="text-text-on-media-muted">The YORD story, established 2024</span>
          </div>
        </div>

        <div className="sl-story__frame sl-chamfer sl-chamfer--flip">
          <div className="sl-chamfer__in">
            <Image src="/concepts/stagelight/brand-fabric.jpg" alt="Close view of heavy French terry cotton with one gold thread" fill sizes="(max-width: 1024px) 80vw, 440px" className="object-cover" />
            <Monogram />
          </div>
        </div>
      </div>

      <ul className="sl-values">
        {VALUES.map((v) => (
          <li key={v.kind} className="sl-value">
            <ValueGlyph kind={v.kind} className="sl-value__glyph text-accent-on-media" />
            <h3 className="font-[family-name:var(--font-bevellier)] text-text-on-media">{v.title}</h3>
            <p className="text-text-on-media-muted">{v.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
