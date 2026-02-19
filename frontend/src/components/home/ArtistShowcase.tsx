'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ARTISTS } from '@/types/database';

export function ArtistShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const artists = Object.values(ARTISTS);

  return (
    <section ref={containerRef} className="py-24 bg-noir-950 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200 mb-3">
              EXCLUSIVE COLLECTIONS
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
              Featured Artists
            </h2>
          </div>
          <Link
            href="/artists"
            className="hidden sm:flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors group"
            data-cursor="pointer"
          >
            VIEW ALL
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      {/* Artist Cards - Horizontal Scroll */}
      <div className="relative">
        {/* Gradient Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-noir-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-noir-950 to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 px-6 lg:px-12 pb-4" style={{ width: 'max-content' }}>
            {artists.map((artist, index) => (
              <motion.div
                key={artist.handle}
                initial={{ opacity: 0, x: 50 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <ArtistCard artist={artist} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View All Link */}
      <div className="sm:hidden mt-8 text-center">
        <Link
          href="/artists"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors"
        >
          VIEW ALL ARTISTS
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function ArtistCard({ artist }: { artist: (typeof ARTISTS)[keyof typeof ARTISTS] }) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // 3D tilt effect - max 7.5 degrees
    setRotateY((x - 0.5) * 15);
    setRotateX((0.5 - y) * 15);

    // Spotlight glow position
    setGlowPosition({ x: x * 100, y: y * 100 });
  };

  const handleMouseEnter = () => setIsHovering(true);

  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <Link
      href={`/artist/${artist.handle}`}
      className="group relative block w-[280px] sm:w-[320px] aspect-[3/4] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-cursor="pointer"
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
        transition: isHovering ? 'none' : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Background with Artist Color */}
      <div
        className="absolute inset-0 transition-all duration-500 group-hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${artist.accentColor}20 0%, ${artist.secondaryColor}30 100%)`,
        }}
      />

      {/* Artist Image */}
      <div className="absolute inset-0 bg-noir-800">
        {artist.heroImage && (
        <Image
          src={artist.heroImage}
          alt={artist.name}
          fill
          sizes="(max-width: 640px) 280px, 320px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        )}
      </div>

      {/* Spotlight Glow Effect - follows cursor */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(
            400px circle at ${glowPosition.x}% ${glowPosition.y}%,
            ${artist.accentColor}25 0%,
            transparent 60%
          )`,
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-noir-950 via-noir-950/50 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end" style={{ transform: 'translateZ(20px)' }}>
        {/* Artist Accent Line */}
        <motion.div
          className="h-0.5 w-12 mb-4"
          style={{ backgroundColor: artist.accentColor }}
          whileHover={{ width: 60 }}
          transition={{ duration: 0.3 }}
        />

        {/* Artist Name */}
        <h3 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-1 group-hover:text-gold-200 transition-colors">
          {artist.name}
        </h3>

        {/* Tagline */}
        <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-ivory-400 mb-4">
          {(artist.tagline || 'Fan Collection').toUpperCase()}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className="font-[family-name:var(--font-bebas)] tracking-[0.1em]"
            style={{ color: artist.accentColor }}
          >
            SHOP COLLECTION
          </span>
          <ArrowRight
            size={14}
            style={{ color: artist.accentColor }}
            className="group-hover:translate-x-1 transition-transform"
          />
        </div>
      </div>

      {/* Animated Gradient Border on Hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(var(--border-angle, 0deg), ${artist.accentColor} 0%, transparent 50%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor',
          WebkitMaskComposite: 'xor',
          padding: '2px',
          animation: isHovering ? 'borderRotate 3s linear infinite' : 'none',
        }}
      />

      {/* Bottom Accent Line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: artist.accentColor }}
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </Link>
  );
}
