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

  /**
   * Accent colours per collection type. Purely decorative (a blurred blob
   * behind the header and the small bar next to the title), never text.
   *
   * The generic entries — the two computed collections and every unlisted
   * handle — use `var(--accent)` rather than a gold literal, because the
   * storefront default theme is light and light mode's accent is bronze: a
   * #FFD966 blob at opacity-10 over `--surface-card` (#FBFBFA) is invisible,
   * so the intended accent wash silently does not render. Brand-ish hooks
   * (Bestsellers, Limited Editions, Sale, category colours) keep their own
   * colour and are theme-invariant by design, like artist brand colours.
   */
  const getAccentColor = (collectionHandle: string) => {
    const colors: Record<string, string> = {
      // Canonical handle for the Bestsellers nav target: the footer/header
      // link to /collection/bestsellers. The old `best-sellers` twin was
      // deleted from the database, so it must not keep an entry here.
      'bestsellers': '#FFD700',
      'limited-edition': '#FF4444',
      'sale': '#FF6B6B',
      'hoodies': '#8B5CF6',
      't-shirts': '#3B82F6',
      'accessories': '#10B981',
    };
    return colors[collectionHandle] || 'var(--accent)';
  };

  const accentColor = getAccentColor(handle);

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-surface-card">
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
              <Link href="/" className="text-text-muted hover:text-accent transition-colors">
                Home
              </Link>
            </li>
            <ChevronRight size={14} className="text-text-muted" />
            <li>
              <Link href="/collections" className="text-text-muted hover:text-accent transition-colors">
                Collections
              </Link>
            </li>
            <ChevronRight size={14} className="text-text-muted" />
            <li className="text-text-secondary">{title}</li>
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
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary">
              {title}
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-[family-name:var(--font-jakarta)] text-lg text-text-muted leading-relaxed"
          >
            {description}
          </motion.p>

          {productCount !== undefined && productCount > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-muted"
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
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-default to-transparent"
          style={{ originX: 0 }}
        />
      </div>
    </section>
  );
}
