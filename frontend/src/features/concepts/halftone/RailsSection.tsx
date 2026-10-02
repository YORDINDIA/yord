import Link from 'next/link';
import type { ArtistRail } from '@/features/concepts/loaders';
import { ArrowLink } from './Arrow';
import { DitherImage } from './DitherImage';
import { ProductGrid } from './ProductGrid';
import { Reveal } from './Reveal';

/** One emphasised word per headline: the last word of the name goes italic. */
function Name({ name }: { name: string }) {
  const at = name.lastIndexOf(' ');
  if (at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)} <em>{name.slice(at + 1)}</em>
    </>
  );
}

export function RailsSection({ rails }: { rails: Array<ArtistRail | null> }) {
  const live = rails.filter((r): r is ArtistRail => r !== null);
  if (live.length === 0) return null;

  return (
    <section aria-label="Shop by artist" className="ht-section ht-wash ht-rails">
      <div className="ht-wrap">
        {live.map(({ artist, products }, i) => (
          <article key={artist.handle} className="ht-rail" data-flip={i % 2 === 1 ? '' : undefined}>
            {artist.heroImage && (
              <Link href={`/artist/${artist.handle}`} className="ht-rail__portrait" data-cursor="pointer">
                <DitherImage
                  src={artist.heroImage}
                  alt={`${artist.name} on stage`}
                  sizes="(min-width: 1024px) 30vw, 90vw"
                  className="ht-rail__img"
                  pos={[0.5, 0.3]}
                />
              </Link>
            )}
            <div className="ht-rail__body">
              <header className="ht-rail__head">
                <h2 className="ht-display ht-rail__name">
                  <Name name={artist.name} />
                </h2>
                {artist.tagline && <p className="ht-rail__tag">{artist.tagline}</p>}
                <ArrowLink href={`/artist/${artist.handle}`}>View all</ArrowLink>
              </header>
              <Reveal>
                <ProductGrid products={products} cols={2} />
              </Reveal>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
