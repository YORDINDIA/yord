import Link from 'next/link';
import { ArrowRight, MapPin, Calendar, Music } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING } from './section';
import '@/features/ui/reveal.css';
import type { TransformedProductWithSource } from '@yord/db-types';

export interface ConcertArtistData {
  artistHandle: string;
  artistName: string;
  artistImage?: string;
  accentColor: string;
  secondaryColor: string;
  tourName: string;
  nextShowDate: string;
  nextShowCity: string;
  nextShowVenue: string;
  totalUpcomingShows: number;
  products: TransformedProductWithSource[];
}

interface UpcomingConcertsSectionViewProps {
  concertArtists: ConcertArtistData[];
  /** Server render time. Passed in (rather than read here) so the countdown
   *  labels are computed once, from the same instant as the cached data. */
  currentTimestamp: number;
}

function getDaysUntil(dateStr: string, currentTimestamp: number): number {
  const target = new Date(dateStr);
  // Reset time part to ensure day calculation is accurate relative to midnight
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const now = new Date(currentTimestamp);
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diff = targetDate.getTime() - currentDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(days: number): string {
  if (days < 0) return 'PAST EVENT';
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

function formatConcertDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getGridClassName(count: number): string {
  if (count === 1) return 'grid grid-cols-1';
  if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-6';
  if (count === 3) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
}

/**
 * The concert cards are pure presentation — no state, no effects, no
 * handlers — so this is a server component. It used to carry `'use client'`
 * only because the day-countdown was computed in the browser; it was already
 * computed from a server timestamp that the client never re-read, so the
 * client boundary bought nothing and shipped the whole section's JS.
 */
export function UpcomingConcertsSectionView({
  concertArtists,
  currentTimestamp
}: UpcomingConcertsSectionViewProps) {
  if (concertArtists.length === 0) return null;

  const count = concertArtists.length;
  const isSingle = count === 1;

  return (
    <section className={SECTION_PADDING}>
      <div className="container-page">
        <SectionHeading
          className="reveal-up mb-12"
          eyebrow="UPCOMING CONCERTS"
          title="Shop for Upcoming Concerts"
          action={
            <Link
              href="/concerts"
              className="hidden sm:flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors group"
              data-cursor="pointer"
            >
              VIEW ALL CONCERTS
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        />

        {/* Concert Cards - Adaptive Grid */}
        <div className={getGridClassName(count)}>
          {concertArtists.map((concert) => (
            <div key={concert.artistHandle} className="reveal-up">
              {isSingle ? (
                <SingleConcertCard concert={concert} currentTimestamp={currentTimestamp} />
              ) : (
                <ConcertArtistCard concert={concert} currentTimestamp={currentTimestamp} />
              )}
            </div>
          ))}
        </div>

        {/* Mobile View All Link */}
        <div className="sm:hidden mt-8 text-center">
          <Link
            href="/concerts"
            className="inline-flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors"
          >
            VIEW ALL CONCERTS
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Expanded card for when there's only 1 upcoming concert — horizontal layout on desktop */
function SingleConcertCard({
  concert,
  currentTimestamp
}: {
  concert: ConcertArtistData,
  currentTimestamp: number
}) {
  const daysUntil = getDaysUntil(concert.nextShowDate, currentTimestamp);
  const urgencyLabel = getUrgencyLabel(daysUntil);
  const isUrgent = daysUntil >= 0 && daysUntil <= 7;

  return (
    <div className="bg-surface-card border border-border-default overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Left — Concert Info */}
        <div className="p-8 lg:w-2/5 flex flex-col justify-between">
          <div>
            <div
              className="h-0.5 w-16 mb-5"
              style={{ backgroundColor: concert.accentColor }}
            />
            <h3 className="font-display text-3xl md:text-4xl text-text-primary mb-2 flex items-center gap-4">
              {concert.artistImage && (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border-default shrink-0">
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${concert.artistImage})` }}
                  />
                </div>
              )}
              {concert.artistName}
            </h3>
            <p className="font-accent text-sm tracking-[0.15em] text-text-muted mb-6">
              {concert.tourName.toUpperCase()}
            </p>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Calendar size={16} className="text-text-muted" />
                <span className="font-body text-base">
                  {formatConcertDate(concert.nextShowDate)}
                </span>
              </div>
              <span
                className={`px-3 py-1 text-xs font-accent tracking-wider bg-accent-tint text-accent ${isUrgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
              >
                {urgencyLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-text-muted mb-4">
              <MapPin size={16} />
              <span className="font-body text-sm">
                {concert.nextShowCity}
                {concert.nextShowVenue !== 'TBA' && ` — ${concert.nextShowVenue}`}
              </span>
            </div>

            {concert.totalUpcomingShows > 1 && (
              <div className="flex items-center gap-1.5 text-text-muted">
                <Music size={16} />
                <span className="font-body text-sm">
                  {concert.totalUpcomingShows} shows across India
                </span>
              </div>
            )}
          </div>

          {/* The artist colour is a decorative tint, not ink: on the light card
              a bright brand colour as text is ~1.3:1. `color-mix` also fixes
              the `${accentColor}20` form, which silently dropped the
              background whenever the colour was the `var(--accent)` fallback. */}
          <Link
            href={`/artist/${concert.artistHandle}`}
            className="mt-8 flex items-center justify-center gap-2 w-full py-3.5 font-accent text-sm tracking-[0.15em] uppercase text-text-primary transition-all duration-300 hover:brightness-110"
            style={{
              backgroundColor: `color-mix(in srgb, ${concert.accentColor} 14%, transparent)`,
            }}
            data-cursor="pointer"
          >
            SHOP {concert.artistName.toUpperCase()} COLLECTION
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Right — Products Grid */}
        <div className="lg:w-3/5 p-6 lg:p-8 lg:border-l border-border-default">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {concert.products.map((product) => (
              <ProductCard
                key={product.id}
                handle={product.handle}
                title={product.title}
                artist={product.artist}
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                image={product.image}
                badge={product.badge}
                accentColor={product.accentColor}
                product={product.originalProduct}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Accent Line */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: concert.accentColor }}
      />
    </div>
  );
}

/** Standard card for multi-concert grids */
function ConcertArtistCard({
  concert,
  currentTimestamp
}: {
  concert: ConcertArtistData,
  currentTimestamp: number
}) {
  const daysUntil = getDaysUntil(concert.nextShowDate, currentTimestamp);
  const urgencyLabel = getUrgencyLabel(daysUntil);
  const isUrgent = daysUntil >= 0 && daysUntil <= 7;

  return (
    <div className="bg-surface-card border border-border-default overflow-hidden group h-full flex flex-col">
      {/* Concert Info Block */}
      <div className="p-6 pb-4">
        <div
          className="h-0.5 w-12 mb-4"
          style={{ backgroundColor: concert.accentColor }}
        />

        <h3 className="font-display text-2xl text-text-primary mb-1 flex items-center gap-3">
          {concert.artistImage && (
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border-default shrink-0">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${concert.artistImage})` }}
              />
            </div>
          )}
          {concert.artistName}
        </h3>

        <p className="font-accent text-xs tracking-[0.15em] text-text-muted mb-4">
          {concert.tourName.toUpperCase()}
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Calendar size={14} className="text-text-muted" />
            <span className="font-body text-sm">
              {formatConcertDate(concert.nextShowDate)}
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 text-xs font-accent tracking-wider bg-accent-tint text-accent ${isUrgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
          >
            {urgencyLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-text-muted mb-3">
          <MapPin size={14} />
          <span className="font-body text-sm truncate">
            {concert.nextShowCity}
            {concert.nextShowVenue !== 'TBA' && ` — ${concert.nextShowVenue}`}
          </span>
        </div>

        {concert.totalUpcomingShows > 1 && (
          <div className="flex items-center gap-1.5 text-text-muted">
            <Music size={14} />
            <span className="font-body text-xs">
              {concert.totalUpcomingShows} shows across India
            </span>
          </div>
        )}
      </div>

      {/* Products Mini-Grid */}
      <div className="px-6 pb-4 flex-1">
        <div className="grid grid-cols-3 gap-3">
          {concert.products.slice(0, 3).map((product) => (
            <ProductCard
              key={product.id}
              handle={product.handle}
              title={product.title}
              artist={product.artist}
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              image={product.image}
              badge={product.badge}
              accentColor={product.accentColor}
              product={product.originalProduct}
            />
          ))}
        </div>
      </div>

      {/* CTA — same treatment as the single card: the artist colour is a tint
          behind readable `--text-primary` copy, never the text colour itself. */}
      <div className="px-6 pb-6 mt-auto">
        <Link
          href={`/artist/${concert.artistHandle}`}
          className="flex items-center justify-center gap-2 w-full py-3 font-accent text-sm tracking-[0.15em] uppercase text-text-primary transition-all duration-300 hover:brightness-110"
          style={{ backgroundColor: `color-mix(in srgb, ${concert.accentColor} 14%, transparent)` }}
          data-cursor="pointer"
        >
          SHOP {concert.artistName.toUpperCase()} COLLECTION
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Bottom Accent Line */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: concert.accentColor }}
      />
    </div>
  );
}
