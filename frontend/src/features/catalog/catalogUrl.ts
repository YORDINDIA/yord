import type { SortOption } from '@/lib/product';

export interface CatalogFilters {
  artist?: string;
  type?: string;
  sort?: string;
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetical' },
];

/** Build a `/products` URL merging base filters with overrides (null removes). */
export function buildFilterUrl(
  baseFilters: { artist?: string; type?: string; sort?: string },
  overrides: { artist?: string | null; type?: string | null; sort?: string | null }
): string {
  const params = new URLSearchParams();

  const artist = overrides.artist === null ? undefined : (overrides.artist ?? baseFilters.artist);
  const type = overrides.type === null ? undefined : (overrides.type ?? baseFilters.type);
  const sort = overrides.sort === null ? undefined : (overrides.sort ?? baseFilters.sort);

  if (artist) params.set('artist', artist);
  if (type) params.set('type', type);
  if (sort && sort !== 'newest') params.set('sort', sort);

  const queryString = params.toString();
  return queryString ? `/products?${queryString}` : '/products';
}
