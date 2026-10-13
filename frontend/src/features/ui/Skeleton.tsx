import { cn } from '@yord/ui';

/**
 * Variant-driven loading skeletons. Server-safe (pure CSS pulse, no motion)
 * so every `loading.tsx` and `<Suspense>` fallback can use them without
 * adding client boundaries.
 *
 * The variant names describe the shape they stand in for, not the element they
 * render: `product-card` is ONE card with no wrapper, `product-grid` is N of
 * them in the catalog's grid. The old names (`card` / `grid`) read as the
 * opposite of what they did.
 */

type SkeletonVariant =
  | 'product-card'
  | 'product-grid'
  | 'text-block'
  | 'rail'
  | 'hero'
  | 'cart-row';

function Pulse({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse bg-surface-raised', className)} />;
}

/**
 * The catalog grid. A CONTRACT between `CatalogGrid` and the `product-grid`
 * skeleton: a fallback that reflows differently from the content it stands in
 * for is a layout shift, not a skeleton.
 */
export const PRODUCT_GRID_CLASS = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6';

/** Same box as `ProductCard`: 4:5 image, then the fixed-height info block. */
function ProductCardSkeleton() {
  return (
    <div>
      <Pulse className="aspect-[4/5]" />
      <Pulse className="mt-4 h-4 w-1/3" />
      <Pulse className="mt-2 h-[3.1rem] w-full" />
      <Pulse className="mt-2 h-6 w-1/4" />
      <Pulse className="mt-3 h-11 w-full" />
    </div>
  );
}

export function Skeleton({
  variant,
  count = 8,
  className,
}: {
  variant: SkeletonVariant;
  count?: number;
  className?: string;
}) {
  if (variant === 'product-card') {
    return (
      <div role="status" aria-label="Loading" className={className}>
        <ProductCardSkeleton />
      </div>
    );
  }

  if (variant === 'text-block') {
    return (
      <div role="status" aria-label="Loading" className={cn('space-y-3', className)}>
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-2/3" />
      </div>
    );
  }

  if (variant === 'rail') {
    return (
      // Matches the home rails: `flex gap-6` of `w-[260px] sm:w-[280px]` cards
      // inside a horizontal scroller. `overflow-hidden` here is fine — nothing
      // in a skeleton scrolls.
      <div role="status" aria-label="Loading" className={cn('flex gap-6 overflow-hidden', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[260px] sm:w-[280px] flex-shrink-0">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cart-row') {
    return (
      // Matches `CartLineItem`'s row: a 112/128px thumbnail, the title/size
      // column, and the line price bottom-right. It replaced a local copy in
      // `CartContent` that was the same shape one prop away from this file.
      <div role="status" aria-label="Loading" className={cn('flex gap-6', className)}>
        <Pulse className="w-28 h-36 md:w-32 md:h-40 shrink-0" />
        <div className="flex-1 space-y-3 pt-1">
          <Pulse className="h-5 w-2/3" />
          <Pulse className="h-4 w-24" />
        </div>
        <Pulse className="h-8 w-24 shrink-0 self-end" />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div role="status" aria-label="Loading" className={cn('py-24', className)}>
        <Pulse className="h-10 w-48 mb-4 mx-auto" />
        <Pulse className="h-6 w-full max-w-2xl mx-auto mb-8" />
        <Pulse className="h-12 w-56 mx-auto" />
      </div>
    );
  }

  // 'product-grid': CatalogGrid's grid, see PRODUCT_GRID_CLASS.
  return (
    <div role="status" aria-label="Loading products" className={cn(PRODUCT_GRID_CLASS, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Grid-shaped product placeholder; matches the catalog grid breakpoints. */
export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return <Skeleton variant="product-grid" count={count} className={className} />;
}
