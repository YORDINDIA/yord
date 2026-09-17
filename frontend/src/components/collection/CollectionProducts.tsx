'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/ui/ProductCard';
import {
  ProductGridSkeleton,
  ProductGridEmptyState,
  LoadingMoreIndicator,
  GridToggle,
  SortDropdown,
  DEFAULT_SORT_OPTIONS,
  getGridClasses,
  type SortOption,
  type GridSize,
} from '@/components/product/ProductGrid';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { createClient } from '@/lib/supabase/client';
import { getFirstByPosition, getProductBadge } from '@/lib/utils';
import { fetchProductsByIds } from '@/lib/data/productsByIds';
import type { ProductWithDetails, Collection } from '@/types/database';

interface CollectionProductsProps {
  handle: string;
  initialSort?: SortOption;
}

const PAGE_SIZE = 12;

export function CollectionProducts({
  handle,
  initialSort = 'newest',
}: CollectionProductsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Monotonic id: stale in-flight fetches (old sort) are ignored on resolve
  const requestIdRef = useRef(0);

  const hasMore = products.length < totalCount;

  // Fetch products from Supabase
  const fetchProducts = useCallback(async (pageNum: number, append: boolean = false) => {
    const requestId = ++requestIdRef.current;
    if (!append) setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // First get the collection
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('handle', handle)
        .eq('published', true)
        .single();

      const collData = collectionData as Collection | null;

      if (collectionError || !collData) {
        if (requestId !== requestIdRef.current) return;
        setCollection(null);
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      setCollection(collData);

      // Get product IDs from collects junction table
      const { data: collectsData, error: collectsError } = await supabase
        .from('collects')
        .select('product_id')
        .eq('collection_id', collData.id);

      if (collectsError || !collectsData || collectsData.length === 0) {
        if (requestId !== requestIdRef.current) return;
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

      const { data: fetchedProducts, count: total } = await fetchProductsByIds(supabase, productIds, {
        sort: sortBy,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      // Handle empty results
      if (fetchedProducts.length === 0 && append) {
        setTotalCount(products.length);
        return;
      }

      if (append) {
        // Dedupe by id: a stale fetch resolving late must not duplicate rows
        setProducts(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...fetchedProducts.filter(p => !seen.has(p.id))];
        });
      } else {
        setProducts(fetchedProducts);
      }

      setTotalCount(total || 0);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching collection products:', err);
      setError('An unexpected error occurred');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [handle, sortBy, products.length]);

  // Infinite scroll hook
  const { sentinelRef, loadingMore, resetPage } = useInfiniteScroll(
    async (page) => fetchProducts(page, true),
    { hasMore, isLoading: loading }
  );

  // Fetch on mount and when sort changes; deferred: fetch syncs external Supabase store.
  useEffect(() => {
    queueMicrotask(() => {
      resetPage();
      void fetchProducts(1, false);
    });
  }, [sortBy, handle]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSortDropdown(false);
    if (showSortDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSortDropdown]);

  // Helper to get product display data
  const getProductDisplayData = (product: ProductWithDetails) => {
    const variant = getFirstByPosition(product.product_variants);
    const image = getFirstByPosition(product.product_images);

    return {
      handle: product.handle,
      title: product.title,
      artist: product.vendor || '',
      price: variant?.price || 0,
      compareAtPrice: variant?.compare_at_price || null,
      imageSrc: image?.supabase_url || image?.src || undefined,
      imageAlt: image?.alt || product.title,
      badge: getProductBadge(product, variant),
    };
  };

  return (
    <section ref={containerRef} className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-noir-800"
      >
        {/* Product count */}
        <div className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
          {loading ? (
            <span className="animate-pulse">Loading...</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            `${totalCount} products`
          )}
        </div>

        <div className="flex items-center gap-4">
          <SortDropdown
            sortBy={sortBy}
            onSortChange={setSortBy}
            sortOptions={DEFAULT_SORT_OPTIONS}
            showDropdown={showSortDropdown}
            onToggleDropdown={() => setShowSortDropdown(!showSortDropdown)}
          />

          <GridToggle
            gridSize={gridSize}
            onGridSizeChange={setGridSize}
          />
        </div>
      </motion.div>

      {/* Products Grid */}
      {loading ? (
        <ProductGridSkeleton count={8} gridSize={gridSize} />
      ) : products.length > 0 ? (
        <div className={getGridClasses(gridSize)}>
          {products.map((product, index) => {
            const displayData = getProductDisplayData(product);
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3) }}
              >
                <ProductCard
                  product={product}
                  handle={displayData.handle}
                  title={displayData.title}
                  artist={displayData.artist}
                  price={displayData.price}
                  compareAtPrice={displayData.compareAtPrice}
                  imageSrc={displayData.imageSrc}
                  imageAlt={displayData.imageAlt}
                  badge={displayData.badge}
                />
              </motion.div>
            );
          })}
        </div>
      ) : (
        <ProductGridEmptyState
          title="No products found"
          message="Check back soon for new arrivals in this collection."
        />
      )}

      {/* Infinite scroll sentinel */}
      {!loading && hasMore && (
        <div ref={sentinelRef} className="mt-12 py-8 flex justify-center">
          {loadingMore && <LoadingMoreIndicator />}
        </div>
      )}
    </section>
  );
}
