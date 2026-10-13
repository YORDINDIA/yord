import type { ConcertShelf } from '@/features/concepts/loaders';
import { DitherImage } from './DitherImage';
import { ProductGrid } from './ProductGrid';
import { Reveal } from './Reveal';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 19_800_000;

/* Calendar days in IST, so server and browser agree whatever their time zone. */
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

function countdown(date: string, now: number) {
  const days = istDay(Date.parse(date)) - istDay(now);
  if (days <= 0) return 'Today';
  return days === 1 ? 'Tomorrow' : `in ${days} days`;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

export function ConcertsSection({ shelves, now }: { shelves: ConcertShelf[]; now: number }) {
  if (shelves.length === 0) return null;
  const shows = [...shelves].sort((a, b) => Date.parse(a.nextShowDate) - Date.parse(b.nextShowDate));

  return (
    <section aria-labelledby="ht-concerts-title" className="ht-section ht-wash">
      <div className="ht-wrap">
        <h2 id="ht-concerts-title" className="ht-display ht-h2 ht-concerts__title">
          Shop for Upcoming <em>Concerts</em>
        </h2>

        <div className="ht-shows">
          {shows.map((show) => (
            <article key={show.artistHandle} className="ht-show" aria-label={`${show.artistName} in ${show.nextShowCity}`}>
              <header className="ht-show__head">
                {show.artistImage && (
                  <DitherImage
                    src={show.artistImage}
                    alt={show.artistName}
                    sizes="140px"
                    className="ht-show__photo"
                    lens="fill"
                  />
                )}
                <div className="ht-show__info">
                  <h3 className="ht-display ht-show__city">
                    <em>{show.nextShowCity}</em>
                  </h3>
                  <p className="ht-show__who">
                    {show.artistName} <span>{show.tourName}</span>
                  </p>
                  <p className="ht-show__when">
                    <time dateTime={show.nextShowDate}>{formatDate(show.nextShowDate)}</time>
                    <span>{show.nextShowVenue}</span>
                    <strong>{countdown(show.nextShowDate, now)}</strong>
                  </p>
                </div>
              </header>
              <Reveal>
                <ProductGrid products={show.products} />
              </Reveal>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
