import Image from 'next/image';
import Link from 'next/link';
import { Calendar, ChevronRight, MapPin, Music, Ticket } from 'lucide-react';
import { ARTISTS } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import type { Concert } from '@/lib/data/concerts';
import { getConcertImage } from './concertImages';
import { formatConcertDate, getConcertUrgency } from './concertDates';
import { safeTicketUrl } from './concertUi';

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

  const { label: countdown, urgent } = getConcertUrgency(concert, now);
  const ticketUrl = safeTicketUrl(concert.ticketUrl);

  return (
    <article className="group flex flex-col bg-surface-card border border-border-default overflow-hidden hover:border-accent/40 transition-all duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Media */}
      <Link href={`/concerts/${concert.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-surface-raised">
        {image ? (
          <Image
            src={image}
            alt={`${concert.artist} live in concert`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent-tint">
            <Music aria-hidden="true" className="w-12 h-12 text-accent" />
          </div>
        )}
        {/* Chips sit on a photo, so they use the on-media family — a
            theme-following ink would go near-black on the light theme. */}
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/50 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-accent tracking-wider ${
              concert.status === 'upcoming'
                ? 'bg-accent text-text-on-accent'
                : 'bg-accent-tint text-accent'
            }`}
          >
            {concert.status.toUpperCase()}
          </span>
        </div>
        {countdown ? (
          <span
            className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-accent tracking-wider bg-scrim/70 text-text-on-media ${
              urgent ? 'animate-pulse motion-reduce:animate-none' : ''
            }`}
          >
            {countdown}
          </span>
        ) : null}
        <span className="absolute bottom-3 right-3 text-xs text-text-on-media-muted font-body">
          {concert.genre}
        </span>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-6">
        <div aria-hidden="true" className="h-0.5 w-12 mb-4" style={{ backgroundColor: accentColor }} />
        <Link href={`/concerts/${concert.slug}`}>
          <h3 className="font-display text-xl text-text-primary group-hover:text-accent transition-colors">
            {concert.artist}
          </h3>
        </Link>
        <p className="font-heading text-text-muted mb-4">{concert.tourName}</p>

        <div className="space-y-2 text-sm text-text-muted mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} aria-hidden="true" className="shrink-0" />
            <span className="font-body">{formatConcertDate(concert.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} aria-hidden="true" className="shrink-0" />
            <span className="font-body truncate">
              {concert.venue !== 'TBA' ? `${concert.venue}, ` : ''}
              {concert.city}
            </span>
          </div>
        </div>

        {(concert.ticketPriceFrom || ticketUrl) && (
          <div className="flex items-center gap-2 text-sm mb-4">
            <Ticket size={14} aria-hidden="true" className="text-accent shrink-0" />
            {concert.ticketPriceFrom ? (
              <span className="font-body text-text-secondary">
                From {formatPrice(concert.ticketPriceFrom)}
              </span>
            ) : null}
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="font-accent text-xs tracking-[0.15em] text-accent hover:underline"
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
              // The artist colour is the tint behind the label, never the label
              // itself: a brand yellow as text on the light card is ~1.6:1.
              // `color-mix` because the fallback accent is a `var()`, which a
              // hex-alpha suffix would silently drop.
              style={{
                backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 font-accent text-sm tracking-[0.15em] uppercase text-accent transition-all duration-300 hover:brightness-110"
            >
              SHOP {concert.artist.toUpperCase()} MERCH
            </Link>
          </div>
        )}

        {/* Footer */}
        <div
          className={`flex items-center gap-1 text-accent text-sm font-accent tracking-wider ${
            hasMerch ? 'mt-4' : 'mt-auto pt-4'
          }`}
        >
          <Link href={`/concerts/${concert.slug}`} className="flex items-center gap-1 hover:underline">
            VIEW DETAILS <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div aria-hidden="true" className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
    </article>
  );
}
