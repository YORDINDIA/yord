import type { ConceptProduct } from '@/features/concepts/loaders';
import { ArrowLink } from './Arrow';
import { ProductGrid } from './ProductGrid';
import { Reveal } from './Reveal';
import { RetryNote } from './RetryNote';

export function FeaturedSection({ products }: { products: ConceptProduct[] | null }) {
  return (
    <section aria-labelledby="ht-featured-title" className="ht-section ht-wash">
      <div className="ht-wrap">
        <header className="ht-head">
          <h2 id="ht-featured-title" className="ht-display ht-h2">
            Featured <em>Collection</em>
          </h2>
          <ArrowLink href="/collection/new-arrivals">View all</ArrowLink>
        </header>
        {products && products.length > 0 ? (
          <Reveal>
            <ProductGrid products={products} />
          </Reveal>
        ) : (
          <RetryNote>The collection is not loading right now.</RetryNote>
        )}
      </div>
    </section>
  );
}
