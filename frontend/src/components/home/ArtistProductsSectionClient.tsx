'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import type { TransformedProductWithSource } from '@/types/database';

interface ArtistProductsSectionClientProps {
  artistHandle: string;
  artistName: string;
  artistTagline?: string;
  artistImage?: string;
  accentColor: string;
  products: TransformedProductWithSource[];
}

export function ArtistProductsSectionClient({
  artistHandle,
  artistName,
  artistTagline,
  artistImage,
  accentColor,
  products,
}: ArtistProductsSectionClientProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-noir-900 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-8"
        >
          <div className="flex items-center gap-6">
            {/* Artist Avatar */}
            {artistImage && (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-noir-800 shrink-0">
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

            <div>
              {/* Artist Accent Line */}
              <div
                className="h-0.5 w-12 mb-4"
                style={{ backgroundColor: accentColor }}
              />
              <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-1">
                {artistName}
              </h2>
              {artistTagline && (
                <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-ivory-400">
                  {artistTagline.toUpperCase()}
                </p>
              )}
            </div>
          </div>

          <Link
            href={`/artist/${artistHandle}`}
            className="hidden sm:flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] transition-colors group"
            style={{ color: accentColor }}
          >
            SHOP ALL
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      {/* Products - Horizontal Scroll */}
      <div className="relative">
        {/* Gradient Edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-noir-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-noir-900 to-transparent z-10 pointer-events-none" />

        {/* Scrollable Container */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-6 px-6 lg:px-12 pb-4" style={{ width: 'max-content' }}>
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="w-[260px] sm:w-[280px] flex-shrink-0"
              >
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile View All Link */}
      <div className="sm:hidden mt-6 text-center px-6">
        <Link
          href={`/artist/${artistHandle}`}
          className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] transition-colors"
          style={{ color: accentColor }}
        >
          SHOP ALL {artistName.toUpperCase()}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
