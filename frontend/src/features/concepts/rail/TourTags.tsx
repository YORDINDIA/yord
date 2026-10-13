import Link from 'next/link';
import type { ConcertShelf } from '../loaders';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const yearFmt = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: 'UTC' });

/* String lengths and tilts, fixed per position so the row reads as hung by
   hand, not as a grid, and renders the same on server and client. */
const HANG = [
  { drop: 0, tilt: -2.2 },
  { drop: 28, tilt: 1.6 },
  { drop: 10, tilt: -0.8 },
  { drop: 36, tilt: 2.4 },
  { drop: 4, tilt: -1.6 },
  { drop: 22, tilt: 1 },
];

/** Upcoming tours as garment hang tags, each tied to the line by its string. */
export function TourTags({ shelves }: { shelves: ConcertShelf[] }) {
  if (shelves.length === 0) return null;
  return (
    <section className="rl-tours" aria-labelledby="rl-tours-title">
      <h2 id="rl-tours-title" className="rl-section-title">
        On tour, and dressed for it.
      </h2>
      <ul className="rl-tags">
        {shelves.map((s, i) => {
          const hang = HANG[i % HANG.length];
          const date = new Date(s.nextShowDate);
          return (
            <li key={s.artistHandle} style={{ '--drop': `${hang.drop}px`, '--tilt': `${hang.tilt}deg` } as React.CSSProperties}>
              <Link href={`/artist/${s.artistHandle}`} className="rl-tag">
                <span className="rl-tag__string" aria-hidden="true" />
                <span className="rl-tag__body">
                  <span className="rl-tag__artist">{s.artistName}</span>
                  <span className="rl-tag__tour">{s.tourName}</span>
                  <span className="rl-tag__date">
                    {dateFmt.format(date)}
                    <span> {yearFmt.format(date)}</span>
                  </span>
                  <span className="rl-tag__where">
                    {s.nextShowCity}
                    <span>{s.nextShowVenue}</span>
                  </span>
                  <span className="rl-tag__shows">
                    {s.totalUpcomingShows === 1 ? 'One show' : `${s.totalUpcomingShows} shows`} &middot; Shop the tour
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
