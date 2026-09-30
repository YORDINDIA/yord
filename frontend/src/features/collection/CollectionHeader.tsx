'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface CollectionHeaderProps {
  title: string;
  description: string;
  handle: string;
  productCount?: number;
}

export function CollectionHeader({ title, description, handle, productCount }: CollectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  // Accent colors for different collection types
  const getAccentColor = (collectionHandle: string) => {
    const colors: Record<string, string> = {
      'new-arrivals': '#FFD966',
      'best-sellers': '#FFD700',
      'limited-edition': '#FF4444',
      'sale': '#FF6B6B',
      'hoodies': '#8B5CF6',
      't-shirts': '#3B82F6',
      'accessories': '#10B981',
    };
    return colors[collectionHandle] || '#FFD966';
  };

  const accentColor = getAccentColor(handle);

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-noir-900">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px]"
          style={{ backgroundColor: accentColor }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 blur-[100px]"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-6 lg:px-12 py-16 md:py-24">
        {/* Breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <ol className="flex items-center gap-2 text-sm font-[family-name:var(--font-jakarta)]">
            <li>
              <Link href="/" className="text-ivory-400 hover:text-gold-200 transition-colors">
                Home
              </Link>
            </li>
            <ChevronRight size={14} className="text-ivory-600" />
            <li>
              <Link href="/collections" className="text-ivory-400 hover:text-gold-200 transition-colors">
                Collections
              </Link>
            </li>
            <ChevronRight size={14} className="text-ivory-600" />
            <li className="text-ivory-100">{title}</li>
          </ol>
        </motion.nav>

        {/* Title & Description */}
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-4 mb-4"
          >
            <div
              className="w-1 h-12 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50">
              {title}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-[family-name:var(--font-jakarta)] text-lg text-ivory-300 leading-relaxed"
          >
            {description}
          </motion.p>

          {productCount !== undefined && productCount > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-ivory-400"
            >
              {productCount} {productCount === 1 ? 'PRODUCT' : 'PRODUCTS'}
            </motion.p>
          )}
        </div>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-noir-700 to-transparent"
          style={{ originX: 0 }}
        />
      </div>
    </section>
  );
}
