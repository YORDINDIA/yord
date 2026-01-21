'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, ArrowLeft, Disc3 } from 'lucide-react';
import type { ArtistData } from '@/types/database';

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

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
      style={
        {
          '--artist-accent': artist.accentColor,
          '--artist-secondary': artist.secondaryColor,
        } as React.CSSProperties
      }
    >
      {/* Background with Parallax */}
      <motion.div className="absolute inset-0" style={{ y, scale }}>
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-noir-950">
          {/* Artist-themed gradient orbs */}
          <div
            className="absolute top-1/3 left-1/4 w-[700px] h-[700px] rounded-full blur-[150px] opacity-30"
            style={{ background: `radial-gradient(circle, ${artist.accentColor || '#FFD700'}40, transparent)` }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25"
            style={{ background: `radial-gradient(circle, ${artist.secondaryColor || '#1C1C1C'}50, transparent)` }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[180px] opacity-15"
            style={{ background: `radial-gradient(circle, ${artist.accentColor || '#FFD700'}30, ${artist.secondaryColor || '#1C1C1C'}20, transparent)` }}
          />
        </div>

        {/* Noise texture overlay */}
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-noir-950/40 via-noir-950/30 to-noir-950" />
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
          className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-300 hover:text-gold-200 transition-colors group"
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
                borderColor: artist.accentColor || '#FFD700',
                background: `linear-gradient(135deg, ${artist.accentColor || '#FFD700'}20, ${artist.secondaryColor || '#1C1C1C'}20)`,
              }}
            >
              <Disc3 size={32} style={{ color: artist.accentColor || '#FFD700' }} />
            </div>
          </motion.div>

          {/* Artist Name */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="font-[family-name:var(--font-playfair)] text-6xl sm:text-7xl md:text-8xl lg:text-9xl text-ivory-50 mb-4"
          >
            {artist.name}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.3em] mb-8"
            style={{ color: artist.accentColor || '#FFD700' }}
          >
            {(artist.tagline || 'Fan Collection').toUpperCase()}
          </motion.p>

          {/* Accent Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="w-24 h-0.5 mb-8"
            style={{ backgroundColor: artist.accentColor || '#FFD700' }}
          />

          {/* Bio */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="font-[family-name:var(--font-cormorant)] text-xl md:text-2xl text-ivory-200 max-w-3xl mb-12"
          >
            {artist.bio || `Shop exclusive ${artist.name} merchandise.`}
          </motion.p>

          {/* CTA Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="group relative overflow-hidden px-10 py-4 font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-noir-950 transition-all duration-300"
            style={{ backgroundColor: artist.accentColor || '#FFD700' }}
            onClick={() => {
              document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="relative z-10">SHOP THE COLLECTION</span>
            <div
              className="absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-300"
              style={{ backgroundColor: artist.secondaryColor || '#1C1C1C' }}
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
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: artist.accentColor }}>
                  50+
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">PRODUCTS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: artist.accentColor }}>
                  10K+
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">FANS</p>
              </div>
              <div className="gradient-divider" />
              <div className="text-center group cursor-default">
                <p className="font-[family-name:var(--font-playfair)] text-2xl group-hover:scale-105 transition-transform" style={{ color: artist.accentColor }}>
                  5★
                </p>
                <p className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] text-ivory-400 mt-1">RATING</p>
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
            className="flex flex-col items-center gap-2 text-ivory-400 scroll-indicator-line cursor-pointer group"
          >
            <span className="font-[family-name:var(--font-bebas)] text-[10px] tracking-[0.2em] group-hover:text-gold-200 transition-colors">
              SCROLL TO SHOP
            </span>
            <ChevronDown size={20} className="group-hover:text-gold-200 transition-colors" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
