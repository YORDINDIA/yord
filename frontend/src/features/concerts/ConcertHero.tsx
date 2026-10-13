import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, ShoppingBag, Ticket } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import type { Concert } from '@/lib/data/concerts';
import { formatConcertDateLong, getConcertUrgency } from './concertDates';
import { brandChip, safeTicketUrl } from './concertUi';

export interface ConcertHeroProps {
  concert: Concert;
  accentColor: string;
  image?: string;
  imageCredit?: string;
  /** Gates the merch CTA; `/artist/[handle]` 404s without a live collection. */
  hasMerch: boolean;
  now: number;
}

/**
 * The `/concerts/[slug]` hero: artwork, status, the show's headline facts and
 * the two actions (tickets, merch). Split out of `ConcertDetail`, which was the
 * single largest file in the storefront and mixed seven unrelated sections.
 */
export function ConcertHero({
  concert,
  accentColor,
  image,
  imageCredit,
  hasMerch,
  now,
}: ConcertHeroProps) {
  const { label: countdown, urgent } = getConcertUrgency(concert, now);
  const ticketUrl = safeTicketUrl(concert.ticketUrl);
  const ticketChip = brandChip(accentColor);

  return (
    <section className="container-page pb-12">
      <div className="bg-surface-card border border-border-default overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {image ? (
            <div className="md:w-2/5 shrink-0">
              <div className="relative aspect-square">
                <Image
                  src={image}
                  alt={`${concert.artist} live in concert`}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                  priority
                />
              </div>
              {imageCredit ? (
                <p className="px-4 py-2 text-[11px] text-text-muted font-body">
                  Photo: {imageCredit}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 p-8 md:p-12">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={`px-3 py-1 text-xs font-accent tracking-wider ${
                  concert.status === 'upcoming'
                    ? 'bg-accent text-text-on-accent'
                    : 'bg-accent-tint text-accent'
                }`}
              >
                {concert.status.toUpperCase()}
              </span>
              {countdown ? (
                <span
                  className={`px-3 py-1 text-xs font-accent tracking-wider bg-scrim/70 text-text-on-media ${
                    urgent ? 'animate-pulse motion-reduce:animate-none' : ''
                  }`}
                >
                  {countdown}
                </span>
              ) : null}
              <span className="text-sm text-text-muted font-body">{concert.genre}</span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3">
              {concert.artist}
            </h1>
            <p className="font-heading text-2xl md:text-3xl text-accent mb-6">{concert.tourName}</p>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-text-muted mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={18} aria-hidden="true" className="text-accent" />
                <span className="font-body">
                  {concert.venue !== 'TBA' ? `${concert.venue}, ` : ''}
                  {concert.city}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={18} aria-hidden="true" className="text-accent" />
                <span className="font-body">{formatConcertDateLong(concert.date)}</span>
              </div>
            </div>

            <p className="font-body text-text-muted text-lg leading-relaxed max-w-3xl">
              {concert.description}
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap gap-4">
              {ticketUrl ? (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  style={ticketChip.style}
                  className={`inline-flex items-center gap-2 px-8 py-3 font-accent text-sm tracking-[0.1em] transition-colors ${ticketChip.className}`}
                >
                  <Ticket size={16} aria-hidden="true" />
                  GET TICKETS
                  {concert.ticketPriceFrom ? ` · FROM ${formatPrice(concert.ticketPriceFrom)}` : ''}
                </a>
              ) : null}
              {hasMerch ? (
                <Link
                  href={`/artist/${concert.artistHandle}`}
                  className="inline-flex items-center gap-2 px-8 py-3 border border-border-strong text-text-muted font-accent text-sm tracking-[0.1em] hover:border-accent hover:text-accent transition-colors"
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  SHOP {concert.artist.toUpperCase()} MERCH
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
      </div>
    </section>
  );
}
