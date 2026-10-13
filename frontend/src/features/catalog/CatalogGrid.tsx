'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ProductCard } from '@/features/ui/ProductCard';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { ErrorState } from '@/features/ui/ErrorState';
import { ArrowDiag } from '@/features/ui/Glyphs';
import { Skeleton, PRODUCT_GRID_CLASS } from '@/features/ui/Skeleton';
import { useProductsInfinite, type ProductsQuery } from '@/hooks/useProductsInfinite';
import type { SortOption } from '@/lib/product';
import type { ProductWithDetails } from '@yord/db-types';
import { SortSelect } from './SortMenu';

interface CatalogGridProps {
  initialProducts: ProductWithDetails[];
  totalCount: number;
  /** SSR page number backing `initialProducts` (deep-link `?page=N`). */
  initialPage?: number;
  /** Catalog query (mode + filters + sort + pageSize); sort changes navigate. */
  query: ProductsQuery;
  /** Pages without a filter panel show the grid's own sticky sort bar. */
  showSort?: boolean;
  /**
   * Handle sort changes client-side (refetch page 1 via /api/products)
   * instead of navigating to `?sort=`. Used by statically prerendered routes
   * (artist) so the route never awaits searchParams and keeps its ISR.
   * Defaults to the navigating behavior so SSR'd sort URLs keep working.
   */
  clientSort?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Rendered under the empty copy (e.g. a "Clear filters" link). */
  emptyAction?: React.ReactNode;
  /**
   * Target of the "Back to page 1" link on the page-overflow state. Defaults
   * to the current path; /products passes the filter-preserving URL.
   */
  pageOneHref?: string;
}

/**
 * The single catalog grid for `/products`, `/collection/[handle]`, and
 * `/artist/[handle]`. Page 1 is SSR HTML (`initialProducts`); pages 2+ load
 * from `GET /api/products` via `useInfiniteQuery` — one server
 * implementation, so appended pages carry identical fields to page 1.
 *
 * Sort changes navigate (`?sort=`) for fresh SSR HTML — or refetch
 * client-side when `clientSort` is set; pagination appends client-side.
 * The accumulated list is intentionally NOT written back to `?page=`: SSR
 * treats `page=N` as that page's slice, so a deepest-page URL would drop
 * previously appended products on refresh. Failure surfaces a retry button,
 * never a silent stall or a fake empty. An SSR page past the end of the list
 * shows the page-overflow state (message + link back to page 1) instead of the
 * empty-collection copy, so it never contradicts the header's product count.
 *
 * The sort control is a native `<select>`: the previous trigger + `role="listbox"`
 * panel promised arrow-key semantics it never implemented, and a select has
 * them, plus the platform picker on touch.
 */
export function CatalogGrid({
  initialProducts,
  totalCount,
  initialPage = 1,
  query,
  showSort = false,
  clientSort = false,
  emptyTitle = 'No products found',
  emptyMessage = 'Check back soon for new arrivals.',
  emptyAction,
  pageOneHref,
}: CatalogGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Client-side sort (statically prerendered routes): the query key changes,
  // so React Query fetches page 1 in the new order. The seed below carries
  // no rows for the new order — the fetch fills them in.
  const [activeSort, setActiveSort] = useState<SortOption>(query.sort);
  const sortChanged = clientSort && activeSort !== query.sort;
  const activeQuery: ProductsQuery = sortChanged ? { ...query, sort: activeSort } : query;
  // Navigating routes re-render with a new `query.sort` on the same
  // instance; only client-sort routes diverge from it.
  const displaySort = clientSort ? activeSort : query.sort;
  const seedPage = sortChanged ? 1 : initialPage;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useProductsInfinite(activeQuery, sortChanged
    ? undefined
    : {
      data: initialProducts,
      count: totalCount,
      page: initialPage,
      pageSize: query.pageSize,
    }, seedPage);

  const products = data?.pages.flatMap((p) => p.data) ?? [];
  const count = data?.pages[data.pages.length - 1]?.count ?? totalCount;

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

  const handleSortChange = (sort: SortOption) => {
    if (clientSort) {
      // Fresh client fetch for the new order (no reload, no SSR round-trip).
      setActiveSort(sort);
    } else {
      // Fresh SSR HTML for the new order (SEO-friendly); page resets to 1.
      router.push(`${pathname}?sort=${sort}`);
    }
  };

  // A failed page-1 read is an ERROR, not an empty catalog. This check has to
  // come before the empty branch below: with `clientSort` the new sort's seed
  // is `{ data: [] }`, so a failed refetch used to render the empty-collection
  // copy ("No products found / Check back soon for new arrivals") with no way
  // to retry — a lie about a collection that has products.
  if (isError && products.length === 0) {
    return (
      <ErrorState
        as="h2"
        title="Could not load products"
        message="Check your connection and try again."
        onRetry={async () => {
          await refetch();
        }}
        retryLabel="Try again"
        showHomeLink={false}
      />
    );
  }

  if (products.length === 0) {
    // A client-side sort change deliberately seeds an empty page while the new
    // order loads; showing the empty-collection copy for that moment is a lie
    // about a collection that has products.
    if (sortChanged && !isError) {
      return <Skeleton variant="product-grid" count={Math.min(query.pageSize, 8)} />;
    }

    // "This page has nothing" is not "this collection is empty": a deep
    // `?page=` past the end would otherwise show the empty-collection copy
    // under a header that says the collection has hundreds of products.
    const pagePastEnd = initialPage > 1 && totalCount > 0;
    return (
      <EmptyState
        title={pagePastEnd ? 'Nothing on this page' : emptyTitle}
        message={
          pagePastEnd
            ? `Page ${initialPage} is past the end of this list of ${totalCount} products.`
            : emptyMessage
        }
      >
        {pagePastEnd ? (
          // `pathname` by default: page 1 of this route, dropping `?page=` (and
          // any other query). `useSearchParams` is deliberately not used — it
          // would opt the statically prerendered artist route into dynamic
          // rendering. A caller that owns extra filters passes `pageOneHref`.
          <CtaLink href={pageOneHref ?? pathname}>Back to page 1</CtaLink>
        ) : (
          emptyAction
        )}
      </EmptyState>
    );
  }

  return (
    <section>
      {showSort && (
        // Sticky so the sort and count stay reachable while the grid scrolls.
        // The negative margins let the bar's background cover the container's
        // gutters.
        <div className="sticky top-20 z-30 -mx-6 lg:-mx-12 mb-6 flex items-center justify-between gap-4 bg-surface-page px-6 lg:px-12 py-3">
          <p className="font-body text-sm text-text-muted tabular-nums">
            {count} {count === 1 ? 'product' : 'products'}
          </p>
          <SortSelect value={displaySort} onChange={handleSortChange} />
        </div>
      )}

      {/* No entrance animation on the cards: a fade from opacity 0 renders an
          empty grid whenever hydration stalls. */}
      <ul className={PRODUCT_GRID_CLASS}>
        {products.map((product, index) => (
          <li key={product.id}>
            {/* The first row is the LCP on a catalog page. */}
            <ProductCard product={product} priority={index < 2} />
          </li>
        ))}
      </ul>

      {/* Pagination status: error retry, load more, or end of list. Held at a
          fixed height so the button under the cursor does not collapse when it
          is replaced by the spinner mid-click. */}
      <div className="pt-12 pb-4 min-h-[68px] flex flex-col items-center justify-center gap-4">
        {isError ? (
          <div className="text-center">
            <p className="font-body text-sm text-danger mb-4">
              Couldn&apos;t load more products. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="bg-accent-tint px-5 py-3 font-body text-sm font-semibold text-text-primary transition-colors hover:bg-accent hover:text-text-on-accent"
            >
              Try again
            </button>
          </div>
        ) : hasNextPage ? (
          <div ref={sentinelRef}>
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              aria-busy={isFetchingNextPage}
              className="pc-cta inline-flex min-w-56 items-center justify-between gap-6 bg-accent-tint px-5 py-3 font-body text-sm font-semibold text-text-primary transition-colors hover:bg-accent hover:text-text-on-accent disabled:cursor-wait disabled:opacity-70"
            >
              {isFetchingNextPage ? 'Loading' : `Load more (${count - products.length} left)`}
              <ArrowDiag className="pc-cta__arrow rotate-90" />
            </button>
          </div>
        ) : (
          <p className="font-body text-sm text-text-muted">
            You&apos;ve seen all {count} products.
          </p>
        )}
      </div>
    </section>
  );
}
