import { ProductCard } from '@/features/ui/ProductCard';
import type { ConceptProduct } from '@/features/concepts/loaders';

export function ProductGrid({ products, cols = 4 }: { products: ConceptProduct[]; cols?: 2 | 4 }) {
  return (
    <ul className={`ht-products ht-products--${cols}`}>
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
