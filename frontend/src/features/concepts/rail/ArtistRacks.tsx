import Link from 'next/link';
import type { ArtistRail } from '../loaders';
import { HungCard } from './HungCard';
import { ArrowOut } from './Glyphs';

/** One short DOM rail per artist, so the page keeps a single WebGL context. */
export function ArtistRacks({ rails }: { rails: ArtistRail[] }) {
  if (rails.length === 0) return null;
  return (
    <section className="rl-racks" aria-label="Shop by artist">
      {rails.map(({ artist, products }) => (
        <div key={artist.handle} className="rl-rack">
          <div className="rl-rack__head">
            <h2 className="rl-rack__name">{artist.name}</h2>
            <Link href={`/artist/${artist.handle}`} className="rl-link">
              The full rail
              <ArrowOut />
            </Link>
          </div>
          <div className="rl-rack__bar" aria-hidden="true" />
          <ul className="rl-rack__row">
            {products.map((p) => (
              <li key={p.id}>
                <HungCard
                  handle={p.handle}
                  title={p.title}
                  artist={p.artist}
                  price={p.price}
                  compareAtPrice={p.compareAtPrice}
                  image={p.image}
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 70vw"
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
