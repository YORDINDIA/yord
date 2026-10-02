import Link from 'next/link';
import { ProductCard } from '@/features/ui/ProductCard';
import type { ConceptProduct } from '@/features/concepts/loaders';
import { Arrow } from './Arrow';
import { Swatches } from './Swatches';
import { FLAT_CARD, cardProps } from './shared';
import type { SwatchData } from './accent';

type Width = 'full' | 'wide' | 'mid';

/* Four staggered columns. Tile widths mix inside a column and the columns
   start at different heights, which leaves the empty gaps on purpose. The
   last tile of each column sits on the shared bottom edge. */
const COLUMNS: Array<Array<{ at: number | 'cta'; w: Width }>> = [
  [{ at: 0, w: 'full' }, { at: 4, w: 'mid' }],
  [{ at: 1, w: 'full' }, { at: 'cta', w: 'full' }, { at: 5, w: 'wide' }],
  [{ at: 2, w: 'full' }, { at: 6, w: 'wide' }],
  [{ at: 3, w: 'full' }, { at: 7, w: 'full' }],
];

export function Masonry({
  products,
  swatches,
}: {
  products: ConceptProduct[] | null;
  swatches: SwatchData[];
}) {
  const ready = products && products.length > 0 ? products : null;

  return (
    <section aria-labelledby="poster-featured" className="poster-sect" data-tone="page" data-from="page">
      <div className="poster-pad poster-head">
        <h2 id="poster-featured" className="poster-display poster-title">
          Featured
          <br />
          Collection
        </h2>
        <div className="poster-head-aside">
          <Swatches swatches={swatches} variant="inline" />
        </div>
      </div>

      {ready ? (
        <div className="poster-pad poster-masonry">
          {COLUMNS.map((col, ci) => (
            <div key={ci} className="poster-col" data-col={ci}>
              {col.map(({ at, w }) => {
                if (at === 'cta') {
                  return (
                    <Link key="cta" href="/collection/new-arrivals" className="poster-block" data-cursor="pointer">
                      <span className="poster-display poster-block-title">Shop the full drop</span>
                      <Arrow className="poster-block-arrow" />
                    </Link>
                  );
                }
                const p = ready[at];
                if (!p) return null;
                return (
                  <div key={p.id} className="poster-tile poster-invert" data-w={w}>
                    <ProductCard {...cardProps(p)} className={FLAT_CARD} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="poster-pad poster-note">
          The collection did not load.{' '}
          <Link href="/concepts/poster" className="poster-textlink">
            Try again
          </Link>
        </p>
      )}
    </section>
  );
}
