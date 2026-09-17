'use client';

import { useState, useEffect, useRef } from 'react';
import { ProductCard } from '@/components/ui/ProductCard';
import { LoadingMoreIndicator } from './ProductGrid';
import { createClient } from '@/lib/supabase/client';
import { escapeLike, sortProductsByPrice, PRICE_SORT_FETCH_LIMIT } from '@/lib/utils';
import type { ProductWithDetails } from '@/types/database';

interface ProductsGridProps {
  initialProducts: ProductWithDetails[];
  totalCount: number;
  filters: {
    artist?: string;
    type?: string;
    sort: string;
  };
  pageSize?: number;
}

type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'title';

export function ProductsGrid({
  initialProducts,
  totalCount: initialTotalCount,
  filters,
  pageSize = 20,
}: ProductsGridProps) {
  const [products, setProducts] = useState<ProductWithDetails[]>(initialProducts);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  // Monotonic id: stale in-flight fetches (old filters) are ignored on resolve
  const requestIdRef = useRef(0);

  const hasMore = products.length < totalCount;

  // Reset when filters change (also invalidates in-flight fetches); deferred: syncs props to local paging state.
  useEffect(() => {
    requestIdRef.current += 1;
    const nextProducts = initialProducts;
    const nextTotal = initialTotalCount;
    queueMicrotask(() => {
      setProducts(nextProducts);
      setTotalCount(nextTotal);
      setPage(1);
    });
  }, [initialProducts, initialTotalCount, filters.artist, filters.type, filters.sort]);

  const fetchMoreProducts = async (pageNum: number) => {
    // Guard against duplicate fetches using ref
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestId = ++requestIdRef.current;

    try {
      const supabase = createClient();
      const sortBy = filters.sort as SortOption;
      const isPriceSort = sortBy === 'price-asc' || sortBy === 'price-desc';
      // Price sorts fetch the full set (capped), sort globally, then slice
      const from = isPriceSort ? 0 : (pageNum - 1) * pageSize;
      const to = isPriceSort ? PRICE_SORT_FETCH_LIMIT - 1 : from + pageSize - 1;

      let query = supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id, title, price, compare_at_price,
            inventory_quantity, option1, option2, option3, position
          ),
          product_images (
            id, src, supabase_url, alt, position
          )
        `, { count: 'exact' })
        .eq('status', 'active');

      // Apply artist filter
      if (filters.artist) {
        query = query.ilike('vendor', `%${escapeLike(filters.artist)}%`);
      }

      // Apply product type filter
      if (filters.type) {
        query = query.ilike('product_type', `%${escapeLike(filters.type)}%`);
      }

      // Apply sorting: price sorts order by the cached min_price in SQL
      // (supabase/migrations/001_min_price.sql); un-backfilled rows are
      // re-sorted client-side from variant prices below.
      switch (sortBy) {
        case 'title':
          query = query.order('title', { ascending: true });
          break;
        case 'price-asc':
          query = query.order('min_price', { ascending: true, nullsFirst: false });
          break;
        case 'price-desc':
          query = query.order('min_price', { ascending: false, nullsFirst: false });
          break;
        default:
          query = query.order('published_at', { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (requestId !== requestIdRef.current) return;

      if (error) {
        console.error('Error fetching more products:', error);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      let fetchedProducts = (data || []) as ProductWithDetails[];

      // Global price sort, then slice the requested window. SQL min_price
      // ordering is authoritative only when every row is backfilled; fall
      // back to variant-price sorting so NULL-min_price rows land correctly.
      if (isPriceSort && !fetchedProducts.every((p) => Number.isFinite(Number((p as { min_price?: unknown }).min_price)))) {
        fetchedProducts = sortProductsByPrice(fetchedProducts, sortBy === 'price-asc' ? 'asc' : 'desc');
      }
      if (isPriceSort) {
        const start = (pageNum - 1) * pageSize;
        fetchedProducts = fetchedProducts.slice(start, start + pageSize);
      }

      // Handle empty results - stop infinite scroll
      if (fetchedProducts.length === 0) {
        setTotalCount(products.length);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      // Dedupe by id: a stale fetch resolving late must not duplicate rows
      setProducts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...fetchedProducts.filter(p => !seen.has(p.id))];
      });
      if (count !== null) {
        setTotalCount(count);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Unexpected error fetching products:', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current && hasMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchMoreProducts(nextPage);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {loadingMore && <LoadingMoreIndicator />}
        </div>
      )}
    </>
  );
}
