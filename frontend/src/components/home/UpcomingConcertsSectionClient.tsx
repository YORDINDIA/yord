'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Calendar, Music } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import type { TransformedProductWithSource } from '@/types/database';

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

interface UpcomingConcertsSectionClientProps {
  concertArtists: ConcertArtistData[];
  initialTimestamp: number;
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

export function UpcomingConcertsSectionClient({
  concertArtists,
  initialTimestamp
}: UpcomingConcertsSectionClientProps) {
  // Use initial server timestamp directly - this ensures hydration matches
  // The timestamp is passed from server to client, preventing hydration mismatch
  const timestamp = initialTimestamp;

  if (concertArtists.length === 0) return null;

  const count = concertArtists.length;
  const isSingle = count === 1;

  return (
    <section className="py-24 bg-noir-950">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200 mb-3">
              UPCOMING CONCERTS
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
              Shop for Upcoming Concerts
            </h2>
          </div>
          <Link
            href="/concerts"
            className="hidden sm:flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors group"
            data-cursor="pointer"
          >
            VIEW ALL CONCERTS
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Concert Cards - Adaptive Grid */}
        <div className={getGridClassName(count)}>
          {concertArtists.map((concert, index) => (
            <motion.div
              key={concert.artistHandle}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {isSingle ? (
                <SingleConcertCard concert={concert} currentTimestamp={timestamp} />
              ) : (
                <ConcertArtistCard concert={concert} currentTimestamp={timestamp} />
              )}
            </motion.div>
          ))}
        </div>

        {/* Mobile View All Link */}
        <div className="sm:hidden mt-8 text-center">
          <Link
            href="/concerts"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors"
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
    <div className="bg-noir-900 border border-noir-800 overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        {/* Left — Concert Info */}
        <div className="p-8 lg:w-2/5 flex flex-col justify-between">
          <div>
            <div
              className="h-0.5 w-16 mb-5"
              style={{ backgroundColor: concert.accentColor }}
            />
            <h3 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-2 flex items-center gap-4">
              {concert.artistImage && (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-noir-700 shrink-0">
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${concert.artistImage})` }}
                  />
                </div>
              )}
              {concert.artistName}
            </h3>
            <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] text-ivory-400 mb-6">
              {concert.tourName.toUpperCase()}
            </p>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-ivory-200">
                <Calendar size={16} className="text-ivory-400" />
                <span className="font-[family-name:var(--font-jakarta)] text-base">
                  {formatConcertDate(concert.nextShowDate)}
                </span>
              </div>
              <span
                className={`px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider bg-gold-200/20 text-gold-200 ${isUrgent ? 'animate-pulse' : ''}`}
              >
                {urgencyLabel}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-ivory-400 mb-4">
              <MapPin size={16} />
              <span className="font-[family-name:var(--font-jakarta)] text-sm">
                {concert.nextShowCity}
                {concert.nextShowVenue !== 'TBA' && ` — ${concert.nextShowVenue}`}
              </span>
            </div>

            {concert.totalUpcomingShows > 1 && (
              <div className="flex items-center gap-1.5 text-ivory-400">
                <Music size={16} />
                <span className="font-[family-name:var(--font-jakarta)] text-sm">
                  {concert.totalUpcomingShows} shows across India
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/artist/${concert.artistHandle}`}
            className="mt-8 flex items-center justify-center gap-2 w-full py-3.5 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] uppercase transition-all duration-300 hover:brightness-110"
            style={{ backgroundColor: `${concert.accentColor}20`, color: concert.accentColor }}
            data-cursor="pointer"
          >
            SHOP {concert.artistName.toUpperCase()} COLLECTION
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Right — Products Grid */}
        <div className="lg:w-3/5 p-6 lg:p-8 lg:border-l border-noir-800">
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
    <div className="bg-noir-900 border border-noir-800 overflow-hidden group h-full flex flex-col">
      {/* Concert Info Block */}
      <div className="p-6 pb-4">
        <div
          className="h-0.5 w-12 mb-4"
          style={{ backgroundColor: concert.accentColor }}
        />

        <h3 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-1 flex items-center gap-3">
          {concert.artistImage && (
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-noir-700 shrink-0">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${concert.artistImage})` }}
              />
            </div>
          )}
          {concert.artistName}
        </h3>

        <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-ivory-400 mb-4">
          {concert.tourName.toUpperCase()}
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-ivory-200">
            <Calendar size={14} className="text-ivory-400" />
            <span className="font-[family-name:var(--font-jakarta)] text-sm">
              {formatConcertDate(concert.nextShowDate)}
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 text-xs font-[family-name:var(--font-bebas)] tracking-wider bg-gold-200/20 text-gold-200 ${isUrgent ? 'animate-pulse' : ''}`}
          >
            {urgencyLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-ivory-400 mb-3">
          <MapPin size={14} />
          <span className="font-[family-name:var(--font-jakarta)] text-sm truncate">
            {concert.nextShowCity}
            {concert.nextShowVenue !== 'TBA' && ` — ${concert.nextShowVenue}`}
          </span>
        </div>

        {concert.totalUpcomingShows > 1 && (
          <div className="flex items-center gap-1.5 text-ivory-400">
            <Music size={14} />
            <span className="font-[family-name:var(--font-jakarta)] text-xs">
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

      {/* CTA */}
      <div className="px-6 pb-6 mt-auto">
        <Link
          href={`/artist/${concert.artistHandle}`}
          className="flex items-center justify-center gap-2 w-full py-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] uppercase transition-all duration-300 hover:brightness-110"
          style={{ backgroundColor: `${concert.accentColor}20`, color: concert.accentColor }}
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
