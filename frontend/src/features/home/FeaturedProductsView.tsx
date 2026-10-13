import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { CtaLink } from '@/features/ui/CtaLink';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING } from './section';
import '@/features/ui/reveal.css';
import type { TransformedProductWithSource } from '@yord/db-types';

interface FeaturedProductsViewProps {
  products: TransformedProductWithSource[];
}

export function FeaturedProductsView({ products }: FeaturedProductsViewProps) {
  // A successful read that came back empty (no active products) hides the
  // section, the same rule the artist rails use. A *failed* read is handled
  // upstream by `SectionRetry` and never reaches here — an empty catalog must
  // not look like a broken one, or the reverse.
  if (products.length === 0) {
    return null;
  }

  return (
    <section className={`bg-surface-card ${SECTION_PADDING}`}>
      <div className="container-page">
        <SectionHeading
          className="mb-12"
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Sparkles size={16} aria-hidden="true" />
              CURATED FOR YOU
            </span>
          }
          title="Featured Collection"
          action={
            <Link
              href="/collection/new-arrivals"
              className="flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors group"
            >
              SHOP ALL
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        />

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {products.map((product) => (
            <div key={product.id} className="reveal-up">
              <ProductCard
                handle={product.handle}
                title={product.title}
                artist={product.artist}
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                image={product.image}
                badge={product.badge}
                accentColor={product.accentColor}
                product={product.originalProduct}
              />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="reveal-up mt-16 text-center">
          <p className="font-heading text-xl text-text-secondary mb-6">
            Explore our complete collection of premium concert merchandise
          </p>
          <CtaLink href="/collection/new-arrivals" size="lg">
            VIEW ALL PRODUCTS
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
