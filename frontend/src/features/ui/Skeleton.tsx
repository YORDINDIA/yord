import { cn } from '@yord/ui';

/**
 * Variant-driven loading skeletons. Server-safe (pure CSS pulse, no motion)
 * so every `loading.tsx` and `<Suspense>` fallback can use them without
 * adding client boundaries.
 */

type SkeletonVariant = 'grid' | 'card' | 'text' | 'hero';

function Pulse({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse bg-surface-raised', className)} />;
}

function ProductCardSkeleton() {
  return (
    <div>
      <Pulse className="aspect-[3/4] mb-4" />
      <Pulse className="h-4 mb-2 w-1/3" />
      <Pulse className="h-5 mb-2 w-full" />
      <Pulse className="h-4 w-1/4" />
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
  if (variant === 'card') {
    return (
      <div role="status" aria-label="Loading" className={className}>
        <ProductCardSkeleton />
      </div>
    );
  }
  if (variant === 'text') {
    return (
      <div role="status" aria-label="Loading" className={cn('space-y-3', className)}>
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-2/3" />
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
  // 'grid'
  return (
    <div
      role="status"
      aria-label="Loading products"
      className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Grid-shaped product placeholder; matches the catalog grid breakpoints. */
export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return <Skeleton variant="grid" count={count} className={className} />;
}
