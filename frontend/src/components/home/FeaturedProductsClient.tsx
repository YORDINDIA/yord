'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import type { TransformedProductWithSource } from '@/types/database';

interface FeaturedProductsClientProps {
  products: TransformedProductWithSource[];
}

export function FeaturedProductsClient({ products }: FeaturedProductsClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  return (
    <section ref={containerRef} className="py-24 bg-noir-900">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-gold-200" />
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-gold-200">
                CURATED FOR YOU
              </p>
            </div>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
              Featured Collection
            </h2>
          </div>
          <Link
            href="/collection/new-arrivals"
            className="flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-100 hover:text-gold-200 transition-colors group"
          >
            SHOP ALL
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
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

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="font-[family-name:var(--font-cormorant)] text-xl text-ivory-200 mb-6">
            Explore our complete collection of premium concert merchandise
          </p>
          <Link
            href="/collection/new-arrivals"
            className="inline-flex items-center justify-center px-8 py-4 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-gold-300 transition-colors"
          >
            VIEW ALL PRODUCTS
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
