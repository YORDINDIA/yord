'use client';

import { useState, useEffect, useRef } from 'react';
import { ProductCard } from '@/components/ui/ProductCard';
import { LoadingMoreIndicator } from './ProductGrid';
import { createClient } from '@/lib/supabase/client';
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

  const hasMore = products.length < totalCount;

  // Reset when filters change
  useEffect(() => {
    setProducts(initialProducts);
    setTotalCount(initialTotalCount);
    setPage(1);
  }, [initialProducts, initialTotalCount, filters.artist, filters.type, filters.sort]);

  const fetchMoreProducts = async (pageNum: number) => {
    // Guard against duplicate fetches using ref
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const supabase = createClient();
      const from = (pageNum - 1) * pageSize;
      const to = from + pageSize - 1;

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
        query = query.ilike('vendor', filters.artist);
      }

      // Apply product type filter
      if (filters.type) {
        query = query.ilike('product_type', filters.type);
      }

      // Apply sorting
      const sortBy = filters.sort as SortOption;
      switch (sortBy) {
        case 'title':
          query = query.order('title', { ascending: true });
          break;
        case 'price-asc':
        case 'price-desc':
          query = query.order('published_at', { ascending: false });
          break;
        default:
          query = query.order('published_at', { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error('Error fetching more products:', error);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      let fetchedProducts = (data || []) as ProductWithDetails[];

      // Client-side price sorting
      if (sortBy === 'price-asc') {
        fetchedProducts = fetchedProducts.sort((a, b) => {
          const priceA = a.product_variants?.[0]?.price || 0;
          const priceB = b.product_variants?.[0]?.price || 0;
          return priceA - priceB;
        });
      } else if (sortBy === 'price-desc') {
        fetchedProducts = fetchedProducts.sort((a, b) => {
          const priceA = a.product_variants?.[0]?.price || 0;
          const priceB = b.product_variants?.[0]?.price || 0;
          return priceB - priceA;
        });
      }

      // Handle empty results - stop infinite scroll
      if (fetchedProducts.length === 0) {
        setTotalCount(products.length);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        return;
      }

      setProducts(prev => [...prev, ...fetchedProducts]);
      if (count !== null) {
        setTotalCount(count);
      }
    } catch (err) {
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
