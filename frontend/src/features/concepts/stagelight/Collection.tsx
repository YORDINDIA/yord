import Link from 'next/link';
import type { ConceptProduct } from '@/features/concepts/loaders';
import { ArrowDiag } from './Glyphs';
import { ProductGrid } from './ProductGrid';

export function Collection({ products }: { products: ConceptProduct[] | null }) {
  return (
    <div className="sl-collection">
      <div className="sl-collection__head">
        <h2 className="sl-h2 text-text-primary">Featured Collection</h2>
        <Link href="/collection/new-arrivals" className="sl-textlink text-accent hover:text-accent-hover">
          View all
          <ArrowDiag className="sl-textlink__arrow" />
        </Link>
      </div>
      {products && products.length > 0 ? (
        <ProductGrid products={products} layout="wide" />
      ) : (
        <p className="text-text-muted">
          The collection is not loading right now. Reload in a moment, or browse{' '}
          <Link href="/collections" className="text-accent underline underline-offset-4">all collections</Link>.
        </p>
      )}
    </div>
  );
}
