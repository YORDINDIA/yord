import { cn } from '@yord/ui';
import { ProductCard } from '@/features/ui/ProductCard';
import type { ConceptProduct } from '@/features/concepts/loaders';

/** `quad` is 2 up on a phone and 4 across; `wide` steps 2, 3, 4 for the eight-item collection. */
export function ProductGrid({ products, layout = 'quad' }: { products: ConceptProduct[]; layout?: 'quad' | 'wide' }) {
  return (
    <ul className={cn('sl-pgrid', layout === 'wide' && 'sl-pgrid--wide')}>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard
            handle={p.handle}
            title={p.title}
            artist={p.artist}
            price={p.price}
            compareAtPrice={p.compareAtPrice}
            image={p.image}
            badge={p.badge}
            accentColor={p.accentColor}
            product={p.originalProduct}
          />
        </li>
      ))}
    </ul>
  );
}
