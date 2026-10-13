import Image from 'next/image';
import Link from 'next/link';
import type { ConcertShelf } from '@/features/concepts/loaders';
import { getDaysUntil } from '@/features/concerts/concertDates';
import { ArrowDiag } from './Glyphs';
import { ProductGrid } from './ProductGrid';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function daysUntil(date: string, now: number) {
  const days = Math.max(0, getDaysUntil(date, now));
  if (days === 0) return 'today';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

function Show({ shelf, now, flip }: { shelf: ConcertShelf; now: number; flip: boolean }) {
  const count = shelf.shows.length;
  return (
    <article className="sl-show" data-flip={flip} data-featured={shelf.featured}>
      <div className="sl-show__stage bg-scrim text-text-on-media">
        <div className="sl-show__info">
          {shelf.featured && <p className="sl-show__mark text-accent-on-media">Headline concert</p>}
          <h3 className="sl-show__name font-[family-name:var(--font-bevellier)]">{shelf.artistName}</h3>
          <p className="sl-show__tour text-text-on-media-muted">
            {shelf.tourName} / {count} {count === 1 ? 'date' : 'dates'}
          </p>
          <ol className="sl-dates" aria-label={`${shelf.artistName} dates`}>
            {shelf.shows.map((s) => (
              <li key={s.slug}>
                <Link href={`/concerts/${s.slug}`} className="sl-date">
                  <time dateTime={s.date} className="sl-date__when text-accent-on-media">
                    {dateFmt.format(new Date(s.date))}
                  </time>
                  <span className="sl-date__where">
                    <span className="sl-date__city font-[family-name:var(--font-bevellier)]">{s.city}</span>
                    <span className="sl-date__venue text-text-on-media-muted">{s.venue}</span>
                  </span>
                  <span className="sl-date__count text-text-on-media-muted">{daysUntil(s.date, now)}</span>
                  <ArrowDiag className="sl-date__arrow" />
                </Link>
              </li>
            ))}
          </ol>
          <Link href={`/artist/${shelf.artistHandle}`} className="sl-textlink text-text-on-media hover:text-accent-on-media">
            Shop {shelf.artistName}
            <ArrowDiag className="sl-textlink__arrow" />
          </Link>
        </div>
        {shelf.artistImage && (
          <div className="sl-show__photo sl-chamfer">
            <div className="sl-chamfer__in">
              <Image
                src={shelf.artistImage}
                alt={shelf.artistName}
                fill
                sizes="(max-width: 768px) 70vw, 400px"
                className="object-cover"
                priority={shelf.featured}
              />
            </div>
          </div>
        )}
      </div>
      <div className="sl-show__rack bg-surface-card">
        <ProductGrid products={shelf.products} />
      </div>
    </article>
  );
}

export function Tonight({ shelves, now }: { shelves: ConcertShelf[]; now: number }) {
  return (
    <div className="sl-tonight">
      <h2 className="sl-h2 text-text-on-media">Shop for Upcoming Concerts</h2>
      {shelves.length === 0 ? (
        <p className="text-text-on-media-muted">No shows announced yet. New dates land here first.</p>
      ) : (
        <div className="sl-tonight__list">
          {/* Featured sorts first (getUpcomingConcertsByArtist), so it is never flipped. */}
          {shelves.map((shelf, i) => (
            <Show key={shelf.artistHandle} shelf={shelf} now={now} flip={i % 2 === 1} />
          ))}
        </div>
      )}
    </div>
  );
}
