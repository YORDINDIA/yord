import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { SECTION_PADDING } from './section';
import '@/features/ui/reveal.css';
import type { TransformedProductWithSource } from '@yord/db-types';

interface ArtistProductsSectionViewProps {
  artistHandle: string;
  artistName: string;
  artistTagline?: string;
  artistImage?: string;
  accentColor: string;
  products: TransformedProductWithSource[];
}

export function ArtistProductsSectionView({
  artistHandle,
  artistName,
  artistTagline,
  artistImage,
  accentColor,
  products,
}: ArtistProductsSectionViewProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className={`bg-surface-card overflow-hidden ${SECTION_PADDING}`}>
      <div className="container-page">
        <div className="flex items-center gap-6 mb-8">
          {/* Artist Avatar */}
          {artistImage && (
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-border-default shrink-0">
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundColor: accentColor }}
              />
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${artistImage})` }}
              />
            </div>
          )}

          <SectionHeading
            className="flex-1"
            eyebrow={artistTagline?.toUpperCase()}
            title={artistName}
            action={
              // Artist colour stays a fill, never ink: a bright brand colour as
              // text on this light card is ~1.3:1. Readable copy uses --accent.
              <Link
                href={`/artist/${artistHandle}`}
                className="hidden sm:flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-accent transition-colors group"
              >
                SHOP ALL
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            }
          />
        </div>
      </div>

      {/* Products - Horizontal Scroll */}
      <div className="relative">
        {/* Gradient Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-surface-card to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-surface-card to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 px-6 lg:px-12 pb-4" style={{ width: 'max-content' }}>
            {/* No reveal class here: a horizontal scroller is a scroll
                container, so a `view()` timeline would never play. */}
            {products.map((product) => (
              <div key={product.id} className="w-[260px] sm:w-[280px] flex-shrink-0">
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
        </div>
      </div>

      {/* Mobile View All Link */}
      <div className="sm:hidden mt-6 text-center px-6">
        <Link
          href={`/artist/${artistHandle}`}
          className="inline-flex items-center gap-2 font-accent text-sm tracking-[0.1em] text-accent transition-colors"
        >
          SHOP ALL {artistName.toUpperCase()}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
