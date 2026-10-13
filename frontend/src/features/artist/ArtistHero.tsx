'use client';

import { Fragment, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, ChevronDown, Disc3 } from 'lucide-react';
import { Reveal } from '@/features/ui/Reveal';
import type { ArtistData } from '@yord/db-types';

interface ArtistHeroProps {
  artist: ArtistData;
}

/** Decorative counters. Rendered from one list rather than three copies. */
const STATS = [
  { value: '50+', label: 'PRODUCTS' },
  { value: '10K+', label: 'FANS' },
  { value: '5★', label: 'RATING' },
];

export function ArtistHero({ artist }: ArtistHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.6], [1, 1.1]);

  // Artist brand colours are used for decorative fills, orbs and the CTA
  // surface. They are deliberately NOT used for readable text: a brand yellow
  // reaches only ~1.6:1 on the light page. Readable copy uses --accent.
  // The fallback is the theme-invariant on-media gold, not `--accent`: this
  // surface is dark in both themes, and `--accent` is bronze in light mode.
  const accent = artist.accentColor || 'var(--accent-on-media)';
  const secondary = artist.secondaryColor || '#1C1C1C';

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
      style={
        {
          '--artist-accent': accent,
          '--artist-secondary': secondary,
        } as React.CSSProperties
      }
    >
      {/* Background with Parallax */}
      <motion.div className="absolute inset-0" style={{ y, scale }}>
        {/* Gradient Background */}
        {/* Like the home hero, this is a full-bleed media surface that stays
            DARK in both themes: the artist orbs, the stat glass, and the
            transparent header all sit on top of it. --surface-page would make it
            light in light mode and break every on-media token above it. */}
        <div className="absolute inset-0 bg-scrim">
          {/* Artist-themed gradient orbs */}
          <div
            className="absolute top-1/3 left-1/4 w-[700px] h-[700px] rounded-full blur-[150px] opacity-30"
            style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accent} 25%, transparent), transparent)` }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25"
            style={{ background: `radial-gradient(circle, color-mix(in srgb, ${secondary} 31%, transparent), transparent)` }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[180px] opacity-15"
            style={{ background: `radial-gradient(circle, color-mix(in srgb, ${accent} 19%, transparent), color-mix(in srgb, ${secondary} 13%, transparent), transparent)` }}
          />
        </div>

        {/* Noise texture overlay */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-scrim/40 via-scrim/30 to-surface-page" />
      </motion.div>

      {/* Back Link — to /artists, matching the page's breadcrumb hierarchy
          (Home > Artists > this artist) rather than dropping to the homepage. */}
      <Reveal delay={0.1} y={-10} className="absolute top-24 left-6 lg:left-12 z-30">
        <Link
          href="/artists"
          className="inline-flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-on-media-muted hover:text-accent-on-media transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          ALL ARTISTS
        </Link>
      </Reveal>

      {/* Content - Grid Layout to prevent overlap */}
      <motion.div
        className="relative z-20 min-h-screen grid grid-rows-[1fr_auto_auto]"
        style={{ opacity }}
      >
        {/* Zone 1: Main Content - vertically centered */}
        <div className="flex flex-col items-center justify-center text-center px-6 pt-24">
          {/* Artist Icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border-2 mb-8"
            style={{
              borderColor: accent,
              background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 13%, transparent), color-mix(in srgb, ${secondary} 13%, transparent))`,
            }}
          >
            <Disc3 size={32} style={{ color: accent }} />
          </div>

          {/* Artist Name */}
          <Reveal delay={0.1} className="max-w-full">
            {/* `break-words`: the display face changed from Cormorant to
                Playfair, which is wider, and a long artist name at 9xl would
                otherwise run past the viewport. */}
            <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-text-on-media mb-4 break-words">
              {artist.name}
            </h1>
          </Reveal>

          {/* Tagline */}
          <Reveal delay={0.15}>
            <p
              className="font-accent text-lg tracking-[0.3em] mb-8"
              style={{ color: 'var(--accent-on-media)' }}
            >
              {(artist.tagline || 'Fan Collection').toUpperCase()}
            </p>
          </Reveal>

          {/* Accent Line */}
          <div className="w-24 h-0.5 mb-8" style={{ backgroundColor: accent }} />

          {/* Bio */}
          <Reveal delay={0.2} className="max-w-3xl">
            <p className="font-heading text-xl md:text-2xl text-text-on-media-muted mb-12">
              {artist.bio || `Shop exclusive ${artist.name} merchandise.`}
            </p>
          </Reveal>

          {/* CTA Button — a brand-filled surface, which the shared Button
              variants cannot express (they own their own background), so it
              keeps its own recipe and the dark brand ink. */}
          <Reveal delay={0.25}>
            <button
              type="button"
              className="group relative overflow-hidden px-10 py-4 font-accent text-sm tracking-[0.2em] text-text-on-brand transition-colors duration-300"
              style={{ backgroundColor: accent }}
              onClick={() => {
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span className="relative z-10">SHOP THE COLLECTION</span>
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-300"
                style={{ backgroundColor: 'var(--brand-veil)' }}
              />
            </button>
          </Reveal>
        </div>

        {/* Zone 2: Stats Bar with Premium Styling */}
        <Reveal delay={0.3} className="flex justify-center py-6 px-6">
          <div className="relative max-w-md w-full stats-premium-border">
            <div className="glass py-5 px-8 flex items-center justify-center gap-8">
              {STATS.map((stat, index) => (
                <Fragment key={stat.label}>
                  {index > 0 && <div className="gradient-divider" />}
                  <div className="text-center group cursor-default">
                    <p
                      className="font-display text-2xl group-hover:scale-105 transition-transform"
                      style={{ color: 'var(--accent-on-media)' }}
                    >
                      {stat.value}
                    </p>
                    <p className="font-accent text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">
                      {stat.label}
                    </p>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Zone 3: Scroll Indicator — decorative; the hero CTA above is the
            control, so this is not a second button with the same action. */}
        <div className="flex justify-center pb-8">
          <div className="flex flex-col items-center gap-2 text-text-on-media-muted scroll-indicator-line group">
            <span className="font-accent text-[10px] tracking-[0.2em] group-hover:text-accent-on-media transition-colors">
              SCROLL TO SHOP
            </span>
            {/* CSS bounce rather than a JS loop, so `motion-reduce` can stop it
                without a media-query branch that disagrees with the server. */}
            <ChevronDown
              size={20}
              className="animate-bounce motion-reduce:animate-none group-hover:text-accent-on-media transition-colors"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
