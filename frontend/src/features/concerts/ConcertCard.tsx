import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Calendar, ChevronRight, Music, Ticket } from 'lucide-react';
import { ARTISTS } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import type { Concert } from '@/lib/data/concerts';
import { getConcertImage } from './concertImages';
import { getDaysUntil, getUrgencyLabel, formatConcertDate } from './concertDates';

interface ConcertCardProps {
  concert: Concert;
  /** Gates the merch CTA; /artist/[handle] 404s without a DB collection. */
  hasMerch?: boolean;
  now: number;
  priority?: boolean;
}

/**
 * Rich concert card shared by the listing and city pages: per-concert image,
 * countdown chip, ticket info, and a merch CTA gated on the artist having
 * live products (so it never links to a missing `/artist/[handle]` page).
 */
export function ConcertCard({ concert, hasMerch = false, now, priority = false }: ConcertCardProps) {
  const artist = ARTISTS[concert.artistHandle];
  const accentColor = artist?.accentColor || 'var(--accent)';
  const image = getConcertImage(concert);

  const days = getDaysUntil(concert.date, now);
  const countdown =
    concert.status === 'announced' ? 'ANNOUNCED' : days < 0 ? null : getUrgencyLabel(days);
  const isUrgent = concert.status === 'upcoming' && days >= 0 && days <= 7;

  return (
    <article className="group flex flex-col bg-surface-card border border-border-default overflow-hidden hover:border-accent/40 transition-all duration-300 hover:-translate-y-1">
      {/* Media */}
      <Link href={`/concerts/${concert.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-raised">
        {image ? (
          <Image
            src={image}
            alt={`${concert.artist} live in concert`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent-tint">
            <Music className="w-12 h-12 text-accent" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider ${
              concert.status === 'upcoming'
                ? 'bg-accent-tint-strong text-accent'
                : 'bg-accent-tint text-accent'
            }`}
          >
            {concert.status.toUpperCase()}
          </span>
        </div>
        {countdown && (
          <span
            className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider bg-black/60 text-white backdrop-blur-sm ${isUrgent ? 'animate-pulse' : ''}`}
          >
            {countdown}
          </span>
        )}
        <span className="absolute bottom-3 right-3 text-xs text-white/80 font-[family-name:var(--font-jakarta)]">
          {concert.genre}
        </span>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-6">
        <div className="h-0.5 w-12 mb-4" style={{ backgroundColor: accentColor }} />
        <Link href={`/concerts/${concert.slug}`}>
          <h3 className="font-[family-name:var(--font-playfair)] text-xl text-text-primary group-hover:text-accent transition-colors">
            {concert.artist}
          </h3>
        </Link>
        <p className="font-[family-name:var(--font-cormorant)] text-text-muted mb-4">
          {concert.tourName}
        </p>

        <div className="space-y-2 text-sm text-text-muted mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="shrink-0" />
            <span className="font-[family-name:var(--font-jakarta)]">
              {formatConcertDate(concert.date)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="shrink-0" />
            <span className="font-[family-name:var(--font-jakarta)] truncate">
              {concert.venue !== 'TBA' ? `${concert.venue}, ` : ''}
              {concert.city}
            </span>
          </div>
        </div>

        {(concert.ticketPriceFrom || concert.ticketUrl) && (
          <div className="flex items-center gap-2 text-sm mb-4">
            <Ticket size={14} className="text-accent shrink-0" />
            {concert.ticketPriceFrom ? (
              <span className="font-[family-name:var(--font-jakarta)] text-text-secondary">
                From {formatPrice(concert.ticketPriceFrom)}
              </span>
            ) : null}
            {concert.ticketUrl ? (
              <a
                href={concert.ticketUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-accent hover:underline"
              >
                GET TICKETS
              </a>
            ) : null}
          </div>
        )}

        {/* Merch CTA */}
        {hasMerch && (
          <div className="mt-auto pt-4 border-t border-border-default">
            <Link
              href={`/artist/${concert.artistHandle}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] uppercase transition-all duration-300 hover:brightness-110"
              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
            >
              SHOP {concert.artist.toUpperCase()} MERCH
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center gap-1 text-accent text-sm font-[family-name:var(--font-bebas)] tracking-wider ${hasMerch ? 'mt-4' : 'mt-auto pt-4'}`}>
          <Link href={`/concerts/${concert.slug}`} className="flex items-center gap-1 hover:underline">
            VIEW DETAILS <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
    </article>
  );
}
