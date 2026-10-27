import { parseSortParam, type SortOption } from '@/lib/product';
import { parseCatalogFilters } from '@/lib/catalogFilters';

/** Catalog URL state. Every value is the raw search-param string. */
export interface CatalogFilters {
  artist?: string;
  type?: string;
  size?: string;
  price?: string;
  stock?: string;
  sort?: string;
}

const KEYS = ['artist', 'type', 'size', 'price', 'stock', 'sort'] as const;

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetical' },
];

/**
 * The `<option>` set for a sort control.
 *
 * `manual` is a collection's own default order (`collects.position`), not a
 * choice the shopper can pick — it is offered only while it is the active
 * order, so the select has something to display, and the handler ignores it.
 * A duplicated label list used to live in CatalogGrid and had already drifted
 * ("Alphabetically" vs "Alphabetical"); SORT_OPTIONS is now the only copy.
 */
export function sortChoices(active: SortOption): { value: SortOption; label: string }[] {
  return active === 'manual' ? [{ value: 'manual', label: 'Curated' }, ...SORT_OPTIONS] : SORT_OPTIONS;
}

/** Merge base filters with overrides; `null` removes a key. */
export function mergeFilters(
  baseFilters: CatalogFilters,
  overrides: { [K in keyof CatalogFilters]?: string | null }
): CatalogFilters {
  const merged: CatalogFilters = {};
  for (const key of KEYS) {
    const value = overrides[key] === null ? undefined : (overrides[key] ?? baseFilters[key]);
    if (value) merged[key] = value;
  }
  return merged;
}

/**
 * Serialize filter state to a query string, including the leading `?`, or `''`
 * when nothing is filtered. `newest` is the default sort, so it stays out of
 * the URL — `/products?sort=newest` and `/products` are the same list.
 */
export function searchFromFilters(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filters[key];
    if (value && !(key === 'sort' && value === 'newest')) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build a catalog URL merging base filters with overrides (null removes).
 * Changing any filter drops `?page=`: page 3 of one result set is not page 3
 * of another.
 */
export function buildFilterUrl(
  baseFilters: CatalogFilters,
  overrides: { [K in keyof CatalogFilters]?: string | null },
  path = '/products'
): string {
  return `${path}${searchFromFilters(mergeFilters(baseFilters, overrides))}`;
}

/**
 * Parse filter state out of a raw search string (`?a=b` or `a=b`).
 *
 * Runs the same `parseCatalogFilters` the server used to run on `searchParams`,
 * so a shared or hand-edited URL yields exactly the filters `GET /api/products`
 * will be asked for. `newest` collapses to `undefined` for the same reason
 * `searchFromFilters` omits it: it is the default, not a choice.
 */
export function filtersFromSearch(search: string): CatalogFilters {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const parsed = parseCatalogFilters(Object.fromEntries(params));
  // Unknown values fall back to `newest`, which is the default — store that as
  // "no choice" so `searchFromFilters` keeps it out of the URL and a round trip
  // through a hand-edited `?sort=nonsense` lands on the canonical URL.
  const sort = parseSortParam(params.get('sort') ?? undefined);
  return {
    artist: parsed.artist,
    type: parsed.type,
    size: parsed.size,
    price: parsed.price,
    stock: parsed.stock ? '1' : undefined,
    sort: sort === 'newest' ? undefined : sort,
  };
}

/** True when anything narrows the catalog. Sort is an order, not a filter. */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(filters.artist || filters.type || filters.size || filters.price || filters.stock);
}
