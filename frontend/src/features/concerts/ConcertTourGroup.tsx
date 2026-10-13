import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Music } from 'lucide-react';
import { ARTISTS } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import type { ConcertTour } from '@/lib/data/concerts';
import { formatConcertDate, getConcertUrgency } from './concertDates';
import { brandChip, safeTicketUrl } from './concertUi';

interface ConcertTourGroupProps {
  tour: ConcertTour;
  /** Gates the merch CTA; /artist/[handle] 404s without a DB collection. */
  hasMerch?: boolean;
  now: number;
  priority?: boolean;
}

/**
 * One concert: the artist and tour once, with every date and location nested
 * under it. The featured tour gets the larger spotlight layout.
 */
export function ConcertTourGroup({ tour, hasMerch = false, now, priority = false }: ConcertTourGroupProps) {
  const big = !!tour.featured;
  const first = tour.dates[0];
  const artist = ARTISTS[tour.artistHandle];
  // Same fallback as getConcertImage: the first date's artwork, else the artist hero.
  const image = first.image ?? artist?.heroImage;
  const accent = artist?.accentColor || 'var(--accent)';
  const chip = brandChip(accent);
  const count = tour.dates.length;

  return (
    <article
      className={`bg-surface-card border overflow-hidden flex flex-col md:flex-row ${
        big ? 'border-border-strong' : 'border-border-default'
      }`}
    >
      <Link
        href={`/concerts/${first.slug}`}
        className={`relative block shrink-0 bg-surface-raised aspect-[16/10] md:aspect-auto ${
          big ? 'md:w-2/5 md:min-h-96' : 'md:w-1/3 md:min-h-64'
        }`}
      >
        {image ? (
          <Image
            src={image}
            alt={`${tour.artist} live in concert`}
            fill
            sizes={big ? '(max-width: 768px) 100vw, 40vw' : '(max-width: 768px) 100vw, 33vw'}
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent-tint">
            <Music aria-hidden="true" className="w-12 h-12 text-accent" />
          </div>
        )}
      </Link>

      <div className={`flex-1 min-w-0 flex flex-col ${big ? 'p-6 md:p-10' : 'p-6 md:p-8'}`}>
        {big && <p className="font-body text-sm font-semibold text-accent mb-2">Headline concert</p>}
        <h3 className={`font-display text-text-primary ${big ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}>
          {tour.artist}
        </h3>
        <p className="font-heading text-text-muted mt-1 mb-6">
          {tour.tourName} · {tour.genre} · {count} {count === 1 ? 'date' : 'dates'}
        </p>

        <ol className="flex flex-col gap-1 mb-6" aria-label={`${tour.artist} dates`}>
          {tour.dates.map((d) => {
            const { label } = getConcertUrgency(d, now);
            const ticketUrl = safeTicketUrl(d.ticketUrl);
            return (
              <li
                key={d.slug}
                className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[11rem_minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 -mx-3 px-3 py-3 transition-colors hover:bg-surface-raised"
              >
                <div className="flex flex-col">
                  <time dateTime={d.date} className="font-body text-sm text-text-secondary tabular-nums">
                    {formatConcertDate(d.date)}
                  </time>
                  {label && <span className="font-accent text-xs tracking-wider text-accent">{label}</span>}
                </div>
                <Link
                  href={`/concerts/${d.slug}`}
                  className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto min-w-0 group/date"
                >
                  <span className="block font-heading text-lg text-text-primary group-hover/date:text-accent transition-colors">
                    {d.city}
                  </span>
                  <span className="block font-body text-sm text-text-muted truncate">
                    {d.venue !== 'TBA' ? d.venue : 'Venue to be announced'}
                  </span>
                </Link>
                <div className="col-start-2 row-start-1 row-span-2 sm:col-start-auto sm:row-start-auto sm:row-span-1 flex flex-col items-end gap-1 text-right">
                  {ticketUrl ? (
                    <a
                      href={ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="inline-flex items-center gap-1 font-accent text-xs tracking-[0.15em] text-accent hover:text-text-primary transition-colors"
                    >
                      TICKETS <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  ) : null}
                  {d.ticketPriceFrom ? (
                    <span className="font-body text-xs text-text-muted">from {formatPrice(d.ticketPriceFrom)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {hasMerch && (
          <Link
            href={`/artist/${tour.artistHandle}`}
            style={chip.style}
            className={`mt-auto self-start inline-flex items-center gap-2 px-6 py-3 font-accent text-sm tracking-[0.1em] transition-[filter] hover:brightness-110 ${chip.className}`}
          >
            SHOP {tour.artist.toUpperCase()} MERCH <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
