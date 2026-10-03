import Image from 'next/image';
import Link from 'next/link';
import type { ConcertShelf } from '@/features/concepts/loaders';
import { Arrow } from './Arrow';

const DAY_MS = 86_400_000;
const IST_MS = 5.5 * 3_600_000;

/* Whole days in India time, from the server-passed `now`. Both operands are
   plain numbers, so the result cannot differ between server and browser. */
function daysUntil(date: string, now: number): number {
  return Math.floor(Date.parse(date) / DAY_MS) - Math.floor((now + IST_MS) / DAY_MS);
}

function countdown(days: number): string {
  if (days < 0) return 'Passed';
  if (days === 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: '2-digit' });
const monthYear = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short', year: 'numeric' });

export function Concerts({ shelves, now }: { shelves: ConcertShelf[]; now: number }) {
  if (shelves.length === 0) return null;
  const rows = [...shelves].sort((a, b) => a.nextShowDate.localeCompare(b.nextShowDate));

  return (
    <section aria-labelledby="poster-concerts" className="poster-sect" data-tone="card" data-from="page">
      <div className="poster-pad poster-head" data-wide>
        <h2 id="poster-concerts" className="poster-display poster-title poster-title-wide">
          Shop for Upcoming
          <br />
          Concerts
        </h2>
        <div className="poster-head-aside">
          <Link href="/concerts" className="poster-textlink" data-cursor="pointer">
            All concerts
            <Arrow className="poster-textlink-arrow" />
          </Link>
        </div>
      </div>

      <ol className="poster-pad poster-rows">
        {rows.map((s) => {
          const date = new Date(s.nextShowDate);
          const days = daysUntil(s.nextShowDate, now);
          return (
            <li key={s.artistHandle} className="poster-row poster-invert">
              <time dateTime={s.nextShowDate} className="poster-row-date">
                <span className="poster-display">{day.format(date)}</span>
                <span>{monthYear.format(date)}</span>
              </time>
              <div className="poster-row-place">
                <p className="poster-display">{s.nextShowCity}</p>
                <p>{s.nextShowVenue}</p>
              </div>
              <p className="poster-row-count" data-past={days < 0 || undefined}>
                {countdown(days)}
              </p>
              <div className="poster-row-artist">
                <Link href={`/artist/${s.artistHandle}`} data-cursor="pointer">
                  {s.artistName}
                </Link>
                <p>
                  {s.totalUpcomingShows > 1 ? `${s.totalUpcomingShows} shows` : '1 show'} · {s.tourName}
                </p>
              </div>
              <ul className="poster-row-thumbs">
                {s.products.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link href={`/product/${p.handle}`} data-cursor="pointer" title={p.title}>
                      {p.image ? (
                        <Image src={p.image} alt={p.title} fill sizes="72px" className="object-cover" />
                      ) : (
                        <span className="sr-only">{p.title}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
