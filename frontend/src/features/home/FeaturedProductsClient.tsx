'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import type { TransformedProductWithSource } from '@yord/db-types';

interface FeaturedProductsClientProps {
  products: TransformedProductWithSource[];
}

export function FeaturedProductsClient({ products }: FeaturedProductsClientProps) {
  return (
    <section className="py-24 bg-surface-card">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-accent" />
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] text-accent">
                CURATED FOR YOU
              </p>
            </div>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-text-primary">
              Featured Collection
            </h2>
          </div>
          <Link
            href="/collection/new-arrivals"
            className="flex items-center gap-2 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-text-secondary hover:text-accent transition-colors group"
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
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
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
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="font-[family-name:var(--font-cormorant)] text-xl text-text-secondary mb-6">
            Explore our complete collection of premium concert merchandise
          </p>
          <Link
            href="/collection/new-arrivals"
            className="inline-flex items-center justify-center px-8 py-4 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] hover:bg-accent-hover transition-colors"
          >
            VIEW ALL PRODUCTS
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
