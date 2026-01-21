'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { Filter } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import {
  ProductGridSkeleton,
  ProductGridEmptyState,
  LoadingMoreIndicator,
  GridToggle,
  SortDropdown,
  SORT_OPTIONS_WITH_FEATURED,
  getGridClasses,
  type SortOption,
  type GridSize,
} from '@/components/product/ProductGrid';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { createClient } from '@/lib/supabase/client';
import { transformProductForCard, sortProductsByPrice } from '@/lib/utils';
import type { ArtistData, ProductWithDetails, TransformedProduct } from '@/types/database';

interface ArtistProductsProps {
  artist: ArtistData;
}

const PAGE_SIZE = 16;

export function ArtistProducts({ artist }: ArtistProductsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-50px' });

  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [gridSize, setGridSize] = useState<GridSize>('large');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<TransformedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const hasMore = products.length < totalCount;

  const fetchProducts = useCallback(async (pageNum: number, append: boolean = false) => {
    if (!append) setLoading(true);

    const supabase = createClient();

    // Get the collection ID for this artist
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('handle', artist.handle)
      .single();

    const collection = collectionData as { id: number } | null;

    if (collectionError || !collection) {
      console.error('Could not find artist collection:', collectionError);
      if (!append) setProducts([]);
      setLoading(false);
      return;
    }

    // Get product IDs from collects junction table
    const { data: collectsData, error: collectsError } = await supabase
      .from('collects')
      .select('product_id')
      .eq('collection_id', collection.id);

    if (collectsError || !collectsData || collectsData.length === 0) {
      if (!append) setProducts([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

    // Calculate pagination
    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Build query with sorting
    let query = supabase
      .from('products')
      .select(`
        id, title, handle, vendor, published_at, tags,
        product_variants (id, price, compare_at_price, inventory_quantity, position),
        product_images (id, src, supabase_url, position)
      `, { count: 'exact' })
      .in('id', productIds)
      .eq('status', 'active');

    // Apply database sorting
    switch (sortBy) {
      case 'title':
        query = query.order('title', { ascending: true });
        break;
      case 'newest':
      case 'featured':
      default:
        query = query.order('published_at', { ascending: false });
    }

    const { data, error, count } = await query.range(from, to);

    if (error || !data) {
      if (!append) setProducts([]);
      setLoading(false);
      return;
    }

    let fetchedProducts = data as ProductWithDetails[];

    // Client-side price sorting (since price is on variants)
    if (sortBy === 'price-asc') {
      fetchedProducts = sortProductsByPrice(fetchedProducts, 'asc');
    } else if (sortBy === 'price-desc') {
      fetchedProducts = sortProductsByPrice(fetchedProducts, 'desc');
    }

    // Transform for display
    const transformed = fetchedProducts.map(p =>
      transformProductForCard(p, {
        artist: artist.name,
        accentColor: artist.accentColor,
      })
    );

    // Handle empty results
    if (transformed.length === 0 && append) {
      setTotalCount(products.length);
      return;
    }

    if (!append && count !== null) {
      setTotalCount(count);
    }

    if (append) {
      setProducts(prev => [...prev, ...transformed]);
    } else {
      setProducts(transformed);
    }

    setLoading(false);
  }, [artist.handle, artist.name, artist.accentColor, sortBy, products.length]);

  // Infinite scroll hook
  const { sentinelRef, loadingMore, resetPage } = useInfiniteScroll(
    async (page) => fetchProducts(page, true),
    { hasMore, isLoading: loading }
  );

  // Initial fetch and reset on sort change
  useEffect(() => {
    resetPage();
    fetchProducts(1, false);
  }, [artist.handle, sortBy]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSortDropdown(false);
    if (showSortDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSortDropdown]);

  return (
    <section
      id="products"
      ref={containerRef}
      className="py-24 bg-noir-950"
      style={{
        '--artist-accent': artist.accentColor,
        '--artist-secondary': artist.secondaryColor,
      } as React.CSSProperties}
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12"
        >
          <div>
            <p
              className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] mb-3"
              style={{ color: artist.accentColor }}
            >
              {artist.name.toUpperCase()} COLLECTION
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
              Shop the Collection
            </h2>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <SortDropdown
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOptions={SORT_OPTIONS_WITH_FEATURED}
              showDropdown={showSortDropdown}
              onToggleDropdown={() => setShowSortDropdown(!showSortDropdown)}
              accentColor={artist.accentColor}
            />

            <GridToggle
              gridSize={gridSize}
              onGridSizeChange={setGridSize}
              accentColor={artist.accentColor}
            />

            {/* Filter Toggle (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 border border-noir-700 text-ivory-100 text-sm"
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </motion.div>

        {/* Products Grid */}
        {loading ? (
          <ProductGridSkeleton count={8} gridSize={gridSize} />
        ) : products.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={getGridClasses(gridSize)}
          >
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3) }}
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
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <ProductGridEmptyState
            title="No products found"
            message={`Check back soon for new ${artist.name} merchandise.`}
          />
        )}

        {/* Infinite scroll sentinel */}
        {!loading && hasMore && (
          <div ref={sentinelRef} className="mt-16 py-8 flex justify-center">
            {loadingMore && <LoadingMoreIndicator accentColor={artist.accentColor} />}
          </div>
        )}
      </div>
    </section>
  );
}
