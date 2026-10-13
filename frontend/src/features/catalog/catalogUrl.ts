import type { SortOption } from '@/lib/product';

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

/**
 * Build a catalog URL merging base filters with overrides (null removes).
 * Changing any filter drops `?page=`: page 3 of one result set is not page 3
 * of another. `newest` is the default sort, so it is left out of the URL.
 */
export function buildFilterUrl(
  baseFilters: CatalogFilters,
  overrides: { [K in keyof CatalogFilters]?: string | null },
  path = '/products'
): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = overrides[key] === null ? undefined : (overrides[key] ?? baseFilters[key]);
    if (value && !(key === 'sort' && value === 'newest')) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
