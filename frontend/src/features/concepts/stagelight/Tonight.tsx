import Image from 'next/image';
import Link from 'next/link';
import type { ConcertShelf } from '@/features/concepts/loaders';
import { ArrowDiag } from './Glyphs';
import { ProductGrid } from './ProductGrid';

const DAY = 86_400_000;
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function daysUntil(date: string, now: number) {
  const days = Math.max(0, Math.ceil((Date.parse(date) - now) / DAY));
  if (days === 0) return 'today';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

function Show({ shelf, now, flip }: { shelf: ConcertShelf; now: number; flip: boolean }) {
  const more = shelf.totalUpcomingShows - 1;
  return (
    <article className="sl-show" data-flip={flip}>
      <div className="sl-show__stage bg-scrim text-text-on-media">
        <div className="sl-show__info">
          <p className="sl-show__when text-accent-on-media">
            {dateFmt.format(new Date(shelf.nextShowDate))}
            <span className="text-text-on-media-muted"> / {daysUntil(shelf.nextShowDate, now)}</span>
          </p>
          <h3 className="sl-show__city font-[family-name:var(--font-bevellier)]">{shelf.nextShowCity}</h3>
          <p className="sl-show__venue text-text-on-media-muted">{shelf.nextShowVenue}</p>
          <p className="sl-show__artist">
            <span className="font-[family-name:var(--font-bevellier)]">{shelf.artistName}</span>
            <span className="text-text-on-media-muted">
              {shelf.tourName}
              {more > 0 ? `, plus ${more} more ${more === 1 ? 'date' : 'dates'}` : ''}
            </span>
          </p>
          <Link href={`/artist/${shelf.artistHandle}`} className="sl-textlink text-text-on-media hover:text-accent-on-media">
            Shop {shelf.artistName}
            <ArrowDiag className="sl-textlink__arrow" />
          </Link>
        </div>
        {shelf.artistImage && (
          <div className="sl-show__photo sl-chamfer">
            <div className="sl-chamfer__in">
              <Image src={shelf.artistImage} alt={shelf.artistName} fill sizes="(max-width: 768px) 70vw, 400px" className="object-cover" />
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
          {shelves.map((shelf, i) => (
            <Show key={shelf.artistHandle} shelf={shelf} now={now} flip={i % 2 === 1} />
          ))}
        </div>
      )}
    </div>
  );
}
