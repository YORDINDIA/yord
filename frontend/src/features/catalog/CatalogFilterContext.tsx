'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { SortOption } from '@/lib/product';
import type { ProductsQuery } from '@/hooks/useProductsInfinite';
import {
  filtersFromSearch,
  hasActiveFilters,
  mergeFilters,
  searchFromFilters,
  type CatalogFilters,
} from './catalogUrl';

interface CatalogFilterContextValue {
  /** Route the filters belong to, for building real `href`s. */
  path: string;
  /** Live filter state, mirroring the query string. */
  filters: CatalogFilters;
  /** The catalog query those filters describe, ready for `useProductsInfinite`. */
  query: ProductsQuery;
  /** Effective order, with the page's own default folded in. */
  sort: SortOption;
  /** Live result count: seeded by SSR, refreshed by every grid fetch. */
  count: number;
  setCount: (count: number) => void;
  /** How many facets are active, for the filter button's badge. */
  activeCount: number;
  /** Any facet set — sort alone does not narrow the list. */
  isFiltered: boolean;
  /** Set (or clear, with `null`) one facet and rewrite the URL. */
  setFilter: (key: keyof CatalogFilters, value: string | null) => void;
  /** Drop every facet, keeping nothing but the path. */
  clearAll: () => void;
}

const CatalogFilterContext = createContext<CatalogFilterContextValue | null>(null);

interface CatalogFilterProviderProps {
  /** Route the filters belong to, e.g. `/products` or `/collection/all`. */
  path: string;
  /**
   * The page's own query: mode, handle, pageSize and default sort. The
   * shopper's filters are layered on top of this in `query`.
   */
  baseQuery: ProductsQuery;
  /** SSR result count for the unfiltered list, so the header never flashes 0. */
  initialCount: number;
  children: ReactNode;
}

/**
 * Catalog filter state, owned by the browser.
 *
 * The pages that render this used to `await searchParams`, which opts a whole
 * route out of static rendering in Next — every request re-ran the Supabase
 * reads and the full React render instead of serving the ISR copy. On Workers
 * Free (10 ms CPU per invocation) that was the single largest source of
 * `exceededResources` errors.
 *
 * So the server now always renders page 1 of the *unfiltered* list and caches
 * it; the shopper's facets are read here after hydration and served by
 * `GET /api/products`. `useSearchParams` is deliberately not used: it needs a
 * Suspense boundary and reintroduces the same render-time coupling this is
 * escaping. `window.location` is read in an effect instead, which also picks
 * up back/forward for free via `popstate`.
 *
 * URL writes go through the native History API, not `router.push` — a router
 * navigation would ask the server to re-render the page, which is the exact
 * round trip this design removes.
 */
export function CatalogFilterProvider({
  path,
  baseQuery,
  initialCount,
  children,
}: CatalogFilterProviderProps) {
  const [filters, setFilters] = useState<CatalogFilters>({});
  const [count, setCount] = useState(initialCount);

  // The mutation handlers read the newest filters without re-creating
  // themselves on every keystroke; a stale closure here would drop a facet.
  const filtersRef = useRef<CatalogFilters>({});

  const commit = useCallback(
    (next: CatalogFilters) => {
      filtersRef.current = next;
      setFilters(next);
      const url = `${path}${searchFromFilters(next)}`;
      if (window.location.pathname + window.location.search !== url) {
        window.history.pushState(null, '', url);
      }
    },
    [path]
  );

  useEffect(() => {
    // The server rendered the unfiltered list, so the first paint is correct
    // for a clean URL. A filtered deep link catches up here, one fetch later.
    const sync = () => {
      const next = filtersFromSearch(window.location.search);
      filtersRef.current = next;
      setFilters(next);
    };
    sync();
    // Back/forward rewrote the URL without us: mirror it back into state.
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const setFilter = useCallback(
    (key: keyof CatalogFilters, value: string | null) => {
      commit(mergeFilters(filtersRef.current, { [key]: value }));
    },
    [commit]
  );

  /** Drop every facet. The chosen order is not a facet, so it survives. */
  const clearAll = useCallback(
    () => commit({ sort: filtersRef.current.sort }),
    [commit]
  );

  const sort = (filters.sort as SortOption | undefined) ?? baseQuery.sort;
  const isFiltered = hasActiveFilters(filters);

  const query = useMemo<ProductsQuery>(
    () => ({
      ...baseQuery,
      artist: filters.artist,
      type: filters.type,
      size: filters.size,
      price: filters.price,
      stock: filters.stock === '1',
      sort,
    }),
    [baseQuery, filters, sort]
  );

  const value = useMemo<CatalogFilterContextValue>(
    () => ({
      path,
      filters,
      query,
      sort,
      count,
      setCount,
      activeCount: [filters.artist, filters.type, filters.size, filters.price, filters.stock]
        .filter(Boolean).length,
      isFiltered,
      setFilter,
      clearAll,
    }),
    [path, filters, query, sort, count, isFiltered, setFilter, clearAll]
  );

  return <CatalogFilterContext.Provider value={value}>{children}</CatalogFilterContext.Provider>;
}

/** Filter state for a catalog page. Throws outside `CatalogFilterProvider`. */
export function useCatalogFilters(): CatalogFilterContextValue {
  const ctx = useContext(CatalogFilterContext);
  if (!ctx) {
    throw new Error('useCatalogFilters must be used inside CatalogFilterProvider');
  }
  return ctx;
}

/**
 * Filter state, or `null` on routes that render a grid without a filter panel
 * (the artist page, which uses `CatalogGrid clientSort` instead).
 */
export function useCatalogFiltersOptional(): CatalogFilterContextValue | null {
  return useContext(CatalogFilterContext);
}

/**
 * Run `apply` for a plain left-click and let everything else through.
 *
 * The filter controls stay real anchors so right-click, copy-link, middle-click
 * and open-in-new-tab keep working — and so a crawler still sees the URL each
 * facet points at. Only the plain click is intercepted, because a navigation
 * there is a full server render for a list the browser can already ask for.
 */
export function onFilterClick(event: MouseEvent<HTMLAnchorElement>, apply: () => void): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  apply();
}
