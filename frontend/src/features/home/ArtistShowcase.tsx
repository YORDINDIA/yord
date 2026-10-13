'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING } from './section';
import '@/features/ui/reveal.css';
import type { ArtistData } from '@yord/db-types';

/**
 * Featured Artists rail.
 *
 * The tiles are the artists the database can actually serve — the caller passes
 * `getArtistsWithMetadata()`, which only returns artist handles whose published
 * collection has products. Rendering the static `ARTISTS` record instead (71
 * handles, 61 with no collection row at all) produced 61 links to the
 * "Artist not found" page. Display name, accent and hero still come from the
 * static metadata, merged into `ArtistData` by the query layer.
 */
/**
 * Handles the owner wants first in the rail, ahead of the product-count order
 * the query layer returns. Pinned here rather than in `getArtistsWithMetadata`
 * because this ordering is homepage merchandising, not a property of the data —
 * `/artists`, the header, the footer and the catalog filters keep the count
 * order. A pinned handle that has no published products simply is not in the
 * list, so nothing renders for it.
 */
const RAIL_PINNED_HANDLES = ['diljit-dosanjh'];

function railOrder(artists: ArtistData[]): ArtistData[] {
  const pinned = RAIL_PINNED_HANDLES.flatMap((handle) =>
    artists.filter((artist) => artist.handle === handle),
  );
  return [...pinned, ...artists.filter((artist) => !RAIL_PINNED_HANDLES.includes(artist.handle))];
}

export function ArtistShowcase({ artists }: { artists: ArtistData[] }) {
  const ordered = railOrder(artists);

  // No artist data (backend hiccup or none published yet): hide the rail
  // rather than render a header over an empty scroll strip.
  if (artists.length === 0) return null;

  return (
    <section className={`reveal-clip bg-surface-page ${SECTION_PADDING}`}>
      <div className="container-page">
        <SectionHeading
          className="reveal-up mb-12"
          eyebrow="EXCLUSIVE COLLECTIONS"
          title="Featured Artists"
          action={
            <Link
              href="/artists"
              className="hidden sm:flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors group"
              data-cursor="pointer"
            >
              VIEW ALL
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        />
      </div>

      {/* Artist Cards - Horizontal Scroll */}
      <div className="relative">
        {/* Gradient Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-surface-page to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-surface-page to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container. A native scroller: touch pans it, the trackpad
            pans it, and `tabIndex` gives it a keyboard entry point so the rail
            is reachable without a pointer (it was hover-only in practice — the
            tiles are links, but nothing moved the strip to bring an off-screen
            tile into view). */}
        <div
          className="overflow-x-auto scrollbar-hide"
          tabIndex={0}
          role="region"
          aria-label="Featured artists"
        >
          <div className="flex gap-6 px-6 lg:px-12 pb-4" style={{ width: 'max-content' }}>
            {/* No reveal class here: a horizontal scroller is a scroll
                container, so a `view()` timeline would never play. */}
            {ordered.map((artist) => (
              <div key={artist.handle}>
                <ArtistCard artist={artist} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View All Link */}
      <div className="sm:hidden mt-8 text-center">
        <Link
          href="/artists"
          className="inline-flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors"
        >
          VIEW ALL ARTISTS
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function ArtistCard({ artist }: { artist: ArtistData }) {
  const [isHovering, setIsHovering] = useState(false);
  const accent = artist.accentColor ?? 'var(--accent)';

  /**
   * Tilt and spotlight are written straight to the element as CSS custom
   * properties. They were three `useState` calls updated on every mousemove —
   * a React re-render of the whole card per event, for two values only CSS
   * ever reads. `isHovering` stays state because it selects a transition.
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // 3D tilt effect - max 7.5 degrees each way
    el.style.setProperty('--tilt-x', `${(0.5 - y) * 15}deg`);
    el.style.setProperty('--tilt-y', `${(x - 0.5) * 15}deg`);
    // Spotlight glow position
    el.style.setProperty('--glow-x', `${x * 100}%`);
    el.style.setProperty('--glow-y', `${y * 100}%`);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    setIsHovering(false);
    // Reset so the 0.5s transition has something to animate back to.
    e.currentTarget.style.setProperty('--tilt-x', '0deg');
    e.currentTarget.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <Link
      href={`/artist/${artist.handle}`}
      className="group relative block w-[280px] sm:w-[320px] aspect-[3/4] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
      data-cursor="pointer"
      style={{
        transform: 'perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
        transformStyle: 'preserve-3d',
        transition: isHovering
          ? 'transform 0.1s ease-out'
          : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Background with Artist Color */}
      <div
        className="absolute inset-0 transition-all duration-500 group-hover:scale-105"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, transparent) 0%, color-mix(in srgb, ${artist.secondaryColor ?? accent} 18%, transparent) 100%)`,
        }}
      />

      {/* Artist Image */}
      <div className="absolute inset-0 bg-surface-raised">
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

      {/* Spotlight Glow Effect - follows the cursor via --glow-x/--glow-y */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(
            400px circle at var(--glow-x, 50%) var(--glow-y, 50%),
            color-mix(in srgb, ${accent} 15%, transparent) 0%,
            transparent 60%
          )`,
        }}
      />

      {/* Gradient Overlay */}
      {/* This wash sits on the artist PHOTO, under the name and tagline, so it
          must stay dark in both themes. `from-surface-page` would put an opaque
          light wash over the bottom of every photo in light mode. */}
      <div className="absolute inset-0 bg-gradient-to-t from-scrim via-scrim/50 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 p-6 flex flex-col justify-end" style={{ transform: 'translateZ(20px)' }}>
        {/* Artist Accent Line */}
        <div
          className="h-0.5 w-12 mb-4 transition-[width] duration-300 group-hover:w-[60px]"
          style={{ backgroundColor: accent }}
        />

        {/* Artist Name */}
        <h3 className="font-display text-2xl text-text-on-media mb-1 group-hover:text-accent-on-media transition-colors">
          {artist.name}
        </h3>

        {/* Tagline */}
        <p className="font-accent text-xs tracking-[0.15em] text-text-on-media-muted mb-4">
          {(artist.tagline || 'Fan Collection').toUpperCase()}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-2 text-sm">
          <span
            className="font-accent tracking-[0.1em]"
            style={{ color: accent }}
          >
            SHOP COLLECTION
          </span>
          <ArrowRight
            size={14}
            style={{ color: accent }}
            className="group-hover:translate-x-1 transition-transform"
          />
        </div>
      </div>
    </Link>
  );
}
