'use client';

import { motion } from 'framer-motion';
import { Grid, LayoutGrid, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/ui/ProductCard';
import { cn } from '@/lib/utils';
import type { ProductWithDetails } from '@/types/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'title';
export type GridSize = 'small' | 'large';

export interface SortOptionConfig {
  value: SortOption;
  label: string;
}

export const DEFAULT_SORT_OPTIONS: SortOptionConfig[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetically' },
];

export const SORT_OPTIONS_WITH_FEATURED: SortOptionConfig[] = [
  { value: 'featured', label: 'Featured' },
  ...DEFAULT_SORT_OPTIONS,
];

// ═══════════════════════════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface ProductSkeletonProps {
  count?: number;
  gridSize?: GridSize;
}

export function ProductGridSkeleton({ count = 8, gridSize = 'large' }: ProductSkeletonProps) {
  return (
    <div
      className={cn(
        'grid gap-6 lg:gap-8',
        gridSize === 'large'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      )}
    >
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[3/4] bg-noir-800 mb-4" />
          <div className="h-4 bg-noir-800 mb-2 w-1/3" />
          <div className="h-5 bg-noir-800 mb-2 w-full" />
          <div className="h-4 bg-noir-800 w-1/4" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING INDICATOR
// ═══════════════════════════════════════════════════════════════════════════

interface LoadingMoreIndicatorProps {
  accentColor?: string;
}

export function LoadingMoreIndicator({ accentColor = '#FFD700' }: LoadingMoreIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
      />
      <span
        className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em]"
        style={{ color: accentColor }}
      >
        LOADING MORE...
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function ProductGridEmptyState({
  title = 'No products found',
  message = 'Check back soon for new arrivals.',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-24 text-center"
    >
      <p className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-400 mb-4">
        {title}
      </p>
      <p className="font-[family-name:var(--font-jakarta)] text-ivory-500">
        {message}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

interface GridToggleProps {
  gridSize: GridSize;
  onGridSizeChange: (size: GridSize) => void;
  accentColor?: string;
}

export function GridToggle({ gridSize, onGridSizeChange, accentColor }: GridToggleProps) {
  return (
    <div className="hidden sm:flex items-center border border-noir-700">
      <button
        onClick={() => onGridSizeChange('large')}
        className={cn(
          'w-10 h-10 flex items-center justify-center transition-colors',
          gridSize === 'large'
            ? 'text-noir-950'
            : 'bg-noir-900 text-ivory-400 hover:text-ivory-100'
        )}
        style={gridSize === 'large' ? { backgroundColor: accentColor || '#FFD700' } : {}}
        aria-label="Large grid"
      >
        <Grid size={18} />
      </button>
      <button
        onClick={() => onGridSizeChange('small')}
        className={cn(
          'w-10 h-10 flex items-center justify-center transition-colors',
          gridSize === 'small'
            ? 'text-noir-950'
            : 'bg-noir-900 text-ivory-400 hover:text-ivory-100'
        )}
        style={gridSize === 'small' ? { backgroundColor: accentColor || '#FFD700' } : {}}
        aria-label="Small grid"
      >
        <LayoutGrid size={18} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SORT DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════

interface SortDropdownProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  sortOptions?: SortOptionConfig[];
  showDropdown: boolean;
  onToggleDropdown: () => void;
  accentColor?: string;
}

export function SortDropdown({
  sortBy,
  onSortChange,
  sortOptions = DEFAULT_SORT_OPTIONS,
  showDropdown,
  onToggleDropdown,
  accentColor = '#FFD700',
}: SortDropdownProps) {
  const selectedLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || 'Sort';

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDropdown();
        }}
        className="flex items-center gap-2 px-4 py-2 bg-noir-900 border border-noir-700 hover:border-ivory-400 transition-colors"
      >
        <SlidersHorizontal size={16} className="text-ivory-400" />
        <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
          {selectedLabel}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-ivory-400 transition-transform',
            showDropdown && 'rotate-180'
          )}
        />
      </button>

      {showDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-2 w-48 bg-noir-900 border border-noir-700 z-50"
        >
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onSortChange(option.value);
                onToggleDropdown();
              }}
              className={cn(
                'w-full px-4 py-3 text-left font-[family-name:var(--font-jakarta)] text-sm transition-colors',
                sortBy === option.value
                  ? 'text-noir-950'
                  : 'text-ivory-100 hover:bg-noir-800'
              )}
              style={sortBy === option.value ? { backgroundColor: `${accentColor}20`, color: accentColor } : {}}
            >
              {option.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PRODUCT GRID DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

interface ProductGridDisplayProps {
  products: ProductWithDetails[];
  gridSize?: GridSize;
  accentColor?: string;
  getDisplayData?: (product: ProductWithDetails) => {
    handle: string;
    title: string;
    artist: string;
    price: number;
    compareAtPrice: number | null;
    image: string | null;
    badge: 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;
  };
}

export function ProductGridDisplay({
  products,
  gridSize = 'large',
  accentColor,
  getDisplayData,
}: ProductGridDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={cn(
        'grid gap-6 lg:gap-8',
        gridSize === 'large'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      )}
    >
      {products.map((product, index) => {
        if (getDisplayData) {
          const displayData = getDisplayData(product);
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
                image={displayData.image}
                badge={displayData.badge}
                accentColor={accentColor}
              />
            </motion.div>
          );
        }

        // Default: use ProductCard with full product data
        return (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3) }}
          >
            <ProductCard product={product} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID CLASS HELPER
// ═══════════════════════════════════════════════════════════════════════════

export function getGridClasses(gridSize: GridSize): string {
  return cn(
    'grid gap-6 lg:gap-8',
    gridSize === 'large'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
  );
}
