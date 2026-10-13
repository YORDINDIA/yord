import Link from 'next/link';
import type { ArtistData } from '@yord/db-types';
import { ArrowLink } from './Arrow';
import { DitherImage } from './DitherImage';

/* Mixed ratios give the columns a staggered, masonry rhythm. Seven is coprime with the
   column count, so columns do not all start on the same ratio. */
/* A page of 64 canvases is a long scroll; the rest sit one click away. */
const SHOWN = 24;

const RATIOS = ['4 / 5', '1 / 1', '3 / 4', '5 / 6', '1 / 1', '4 / 5', '5 / 4'];

export function ArtistsSection({ artists }: { artists: ArtistData[] }) {
  const withPhoto = artists.filter((a): a is ArtistData & { heroImage: string } => Boolean(a.heroImage));

  return (
    <section aria-labelledby="ht-artists-title" className="ht-section">
      <div className="ht-wrap">
        <header className="ht-artists__head">
          <p className="ht-count ht-display">
            <span className="ht-count__n">{withPhoto.length}</span>
            <span className="ht-count__u">artists</span>
          </p>
          <div className="ht-artists__title">
            <h2 id="ht-artists-title" className="ht-display ht-h2">
              Featured <em>Artists</em>
            </h2>
            <ArrowLink href="/artists">All artists</ArrowLink>
          </div>
        </header>

        <ul className="ht-gallery">
          {withPhoto.slice(0, SHOWN).map((a, i) => (
            <li key={a.handle} className="ht-tile">
              <Link href={`/artist/${a.handle}`} className="ht-tile__link" data-cursor="pointer">
                <DitherImage
                  src={a.heroImage}
                  alt={`${a.name} on stage`}
                  sizes="(min-width: 1280px) 18vw, (min-width: 1000px) 22vw, (min-width: 700px) 30vw, 46vw"
                  className="ht-tile__img"
                  lens={96}
                  style={{ aspectRatio: RATIOS[i % RATIOS.length] }}
                />
                <span className="ht-tile__name ht-display">{a.name}</span>
                {a.tagline && <span className="ht-tile__tag">{a.tagline}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ht-artists__more">
          <ArrowLink href="/artists">All {withPhoto.length} artists</ArrowLink>
        </div>
      </div>
    </section>
  );
}
