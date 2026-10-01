'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, ArrowLeft, Disc3 } from 'lucide-react';
import type { ArtistData } from '@yord/db-types';

interface ArtistHeroProps {
  artist: ArtistData;
}

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
  const accent = artist.accentColor || 'var(--accent)';
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

      {/* Back Link */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute top-24 left-6 lg:left-12 z-30"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-text-on-media-muted hover:text-accent-on-media transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          BACK TO HOME
        </Link>
      </motion.div>

      {/* Content - Grid Layout to prevent overlap */}
      <motion.div
        className="relative z-20 min-h-screen grid grid-rows-[1fr_auto_auto]"
        style={{ opacity }}
      >
        {/* Zone 1: Main Content - vertically centered */}
        <div className="flex flex-col items-center justify-center text-center px-6 pt-24">
          {/* Artist Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.3, type: 'spring' }}
            className="mb-8"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-2"
              style={{
                borderColor: accent,
                background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 13%, transparent), color-mix(in srgb, ${secondary} 13%, transparent))`,
              }}
            >
              <Disc3 size={32} style={{ color: accent }} />
            </div>
          </motion.div>

          {/* Artist Name */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="font-[family-name:var(--font-playfair)] text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-text-on-media mb-4"
          >
            {artist.name}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.3em] mb-8"
            style={{ color: 'var(--accent-on-media)' }}
          >
            {(artist.tagline || 'Fan Collection').toUpperCase()}
          </motion.p>

          {/* Accent Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="w-24 h-0.5 mb-8"
            style={{ backgroundColor: accent }}
          />

          {/* Bio */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="font-[family-name:var(--font-cormorant)] text-xl md:text-2xl text-text-on-media-muted max-w-3xl mb-12"
          >
            {artist.bio || `Shop exclusive ${artist.name} merchandise.`}
          </motion.p>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="group relative overflow-hidden px-10 py-4 font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-on-brand transition-all duration-300"
            style={{ backgroundColor: accent }}
            onClick={() => {
              document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="relative z-10">SHOP THE COLLECTION</span>
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-300"
              style={{ backgroundColor: 'var(--brand-veil)' }}
            />
          </motion.button>
        </div>

        {/* Zone 2: Stats Bar with Premium Styling */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="flex justify-center py-6 px-6"
        >
          <div className="relative max-w-md w-full stats-premium-border">
            <div className="glass py-5 px-8 flex items-center justify-center gap-8">
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: 'var(--accent-on-media)' }}>
                  50+
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">PRODUCTS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: 'var(--accent-on-media)' }}>
                  10K+
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">FANS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: 'var(--accent-on-media)' }}>
                  5★
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-text-on-media-muted mt-1">RATING</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Zone 3: Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex justify-center pb-8"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2 text-text-on-media-muted scroll-indicator-line cursor-pointer group"
          >
            <span className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] group-hover:text-accent-on-media transition-colors">
              SCROLL TO SHOP
            </span>
            <ChevronDown size={20} className="group-hover:text-accent-on-media transition-colors" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
