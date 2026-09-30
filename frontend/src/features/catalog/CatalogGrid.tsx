'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Grid, LayoutGrid, SlidersHorizontal, ChevronDown, Loader2 } from 'lucide-react';
import { ProductCard } from '@/features/ui/ProductCard';
import { cn } from '@yord/ui';
import { useProductsInfinite, type ProductsQuery } from '@/hooks/useProductsInfinite';
import type { SortOption } from '@/lib/product';
import type { ProductWithDetails } from '@yord/db-types';

export type GridSize = 'small' | 'large';

interface SortOptionConfig {
  value: SortOption;
  label: string;
}

const DEFAULT_SORT_OPTIONS: SortOptionConfig[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetically' },
];

function getGridClasses(gridSize: GridSize): string {
  return cn(
    'grid gap-6 lg:gap-8',
    gridSize === 'large'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
  );
}

interface CatalogGridProps {
  initialProducts: ProductWithDetails[];
  totalCount: number;
  /** SSR page number backing `initialProducts` (deep-link `?page=N`). */
  initialPage?: number;
  /** Catalog query (mode + filters + sort + pageSize); sort changes navigate. */
  query: ProductsQuery;
  /** Artist/collection pages show the sort dropdown; /products has its own toolbar. */
  showSort?: boolean;
  /** Artist/collection pages show the grid-size toggle. */
  showGridToggle?: boolean;
  /** Replaces the default `{count} products` label left of the controls. */
  toolbarLeft?: React.ReactNode;
  /** Overrides the toolbar row layout (artist rows differ from collection). */
  toolbarClassName?: string;
  accentColor?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}

/**
 * The single catalog grid for `/products`, `/collection/[handle]`, and
 * `/artist/[handle]`. Page 1 is SSR HTML (`initialProducts`); pages 2+ load
 * from `GET /api/products` via `useInfiniteQuery` — one server
 * implementation, so appended pages carry identical fields to page 1.
 *
 * Sort changes navigate (`?sort=`) for fresh SSR HTML; pagination appends
 * client-side and syncs `?page=` via `history.replaceState` (no reload).
 * Failure surfaces a retry button, never a silent stall or a fake empty.
 */
export function CatalogGrid({
  initialProducts,
  totalCount,
  initialPage = 1,
  query,
  showSort = false,
  showGridToggle = false,
  toolbarLeft,
  toolbarClassName = 'flex items-center justify-between gap-4 mb-8 pb-6 border-b border-noir-800',
  accentColor = '#FFD700',
  emptyTitle = 'No products found',
  emptyMessage = 'Check back soon for new arrivals.',
}: CatalogGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useProductsInfinite(query, {
    data: initialProducts,
    count: totalCount,
    page: initialPage,
    pageSize: query.pageSize,
  }, initialPage);

  const products = data?.pages.flatMap((p) => p.data) ?? [];
  const count = data?.pages[data.pages.length - 1]?.count ?? totalCount;
  // Deepest loaded page (a ?page=N deep-link may seed beyond page 1).
  const deepestPage = initialPage + (data?.pages.length ?? 1) - 1;

  // Sync ?page= with the deepest loaded page (replaceState, no reload) so a
  // refresh or share lands on equivalent content via SSR pagination.
  useEffect(() => {
    if (deepestPage <= 1 && initialPage <= 1) return;
    const url = new URL(window.location.href);
    if (deepestPage > 1) url.searchParams.set('page', String(deepestPage));
    else url.searchParams.delete('page');
    window.history.replaceState(null, '', url.toString());
  }, [deepestPage, initialPage]);

  // Sentinel auto-loads the next page; the Load More button below is the
  // explicit (touch/keyboard-friendly) equivalent.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void fetchNextPage();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Close sort dropdown on outside click.
  useEffect(() => {
    if (!showSortDropdown) return;
    const close = () => setShowSortDropdown(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showSortDropdown]);

  const handleSortChange = (sort: SortOption) => {
    // Fresh SSR HTML for the new order (SEO-friendly); page resets to 1.
    router.push(`${pathname}?sort=${sort}`);
  };

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-24 text-center"
      >
        <p className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-400 mb-4">
          {emptyTitle}
        </p>
        <p className="font-[family-name:var(--font-jakarta)] text-ivory-500">
          {emptyMessage}
        </p>
      </motion.div>
    );
  }

  return (
    <section>
      {(showSort || showGridToggle) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
          className={toolbarClassName}
        >
          {toolbarLeft ?? (
            <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
              {count} products
            </div>
          )}

          <div className="flex items-center gap-4">
            {showSort && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortDropdown((v) => !v);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-noir-900 border border-noir-700 hover:border-ivory-400 transition-colors"
                >
                  <SlidersHorizontal size={16} className="text-ivory-400" />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
                    {DEFAULT_SORT_OPTIONS.find((o) => o.value === query.sort)?.label || 'Sort'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn('text-ivory-400 transition-transform', showSortDropdown && 'rotate-180')}
                  />
                </button>

                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-noir-900 border border-noir-700 z-50"
                  >
                    {DEFAULT_SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          handleSortChange(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left font-[family-name:var(--font-jakarta)] text-sm transition-colors',
                          query.sort === option.value
                            ? 'text-noir-950'
                            : 'text-ivory-100 hover:bg-noir-800'
                        )}
                        style={query.sort === option.value ? { backgroundColor: `${accentColor}20`, color: accentColor } : {}}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {showGridToggle && (
              <div className="hidden sm:flex items-center border border-noir-700">
                <button
                  onClick={() => setGridSize('large')}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center transition-colors',
                    gridSize === 'large'
                      ? 'text-noir-950'
                      : 'bg-noir-900 text-ivory-400 hover:text-ivory-100'
                  )}
                  style={gridSize === 'large' ? { backgroundColor: accentColor } : {}}
                  aria-label="Large grid"
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setGridSize('small')}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center transition-colors',
                    gridSize === 'small'
                      ? 'text-noir-950'
                      : 'bg-noir-900 text-ivory-400 hover:text-ivory-100'
                  )}
                  style={gridSize === 'small' ? { backgroundColor: accentColor } : {}}
                  aria-label="Small grid"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* /products keeps its exact grid (2-col mobile); toggle pages use the size-aware grid. */}
      <div className={showGridToggle ? getGridClasses(gridSize) : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12'}>
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3) }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>

      {/* Pagination status: error retry, load more, or end of list */}
      {isError ? (
        <div className="py-8 text-center">
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-400 mb-4">
            Couldn&apos;t load more products. Check your connection and try again.
          </p>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-noir-900 border border-noir-700 text-ivory-100 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-gold-200 transition-colors"
          >
            RETRY
          </button>
        </div>
      ) : hasNextPage ? (
        <div ref={sentinelRef} className="py-8 flex flex-col items-center gap-4">
          {isFetchingNextPage ? (
            <Loader2 size={24} className="text-gold-200 animate-spin" aria-label="Loading more products" />
          ) : (
            <button
              onClick={() => void fetchNextPage()}
              className="px-8 py-3 bg-noir-900 border border-noir-700 text-ivory-100 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-gold-200 transition-colors"
            >
              LOAD MORE
            </button>
          )}
        </div>
      ) : (
        products.length > 0 && (
          <p className="py-8 text-center font-[family-name:var(--font-jakarta)] text-sm text-ivory-500">
            You&apos;ve seen all {count} products.
          </p>
        )
      )}
    </section>
  );
}
