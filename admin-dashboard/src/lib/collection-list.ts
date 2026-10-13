import { clampPage, pageRange } from '@/lib/pagination';
import { COLLECTION_SORTS, isAutoCollectionHandle } from '@/lib/constants';

/**
 * Pure shaping for the collections list.
 *
 * `listCollections` filters and sorts product counts in memory (PostgREST
 * cannot filter or order a row by an aggregated count without an embed the
 * generated types do not cover), so the filter/sort/page half is separated from
 * the queries here and unit-tested on its own. The data module owns the reads;
 * this module owns the arithmetic, including the fact that `count` is the
 * filtered total rather than the page length.
 */

/**
 * One `collections` row, before its product count is attached.
 *
 * The cover and publication fields are optional so a caller that only needs the
 * filter/sort arithmetic (and the unit tests' `seed()` helper) can keep building
 * a seed from the columns it actually selected. `listCollections` always selects
 * them, so the list page can show a cover thumbnail and a real publish date.
 */
export interface CollectionSeed {
  id: number;
  title: string;
  handle: string | null;
  collection_type: string;
  published: boolean | null;
  updated_at: string | null;
  published_at?: string | null;
  sort_order?: string | null;
  disjunctive?: boolean | null;
  /** Pre-migration Shopify storefront URL. */
  image_src?: string | null;
  /** R2 URL written by the admin's cover picker; the storefront prefers it. */
  storage_image_url?: string | null;
}

export interface CollectionListRow extends CollectionSeed {
  productCount: number;
  /** Membership is computed by the storefront; the edit form is read-only. */
  isAuto: boolean;
  /**
   * The cover to render, resolved the way the storefront resolves it:
   * `storage_image_url` first, then `image_src`, and only when the value is a
   * usable image reference (an absolute URL or a `/public` path). `null` means
   * "render the placeholder", not "render a broken image".
   */
  coverUrl: string | null;
}

/**
 * First value that can actually be rendered as an image.
 *
 * `collections.image_src` holds pre-migration Shopify URLs for most rows and is
 * frequently the empty string, so "is the column non-null" is not the same
 * question as "is there a cover to show".
 */
export function displayableCoverUrl(
  ...values: (string | null | undefined)[]
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  }
  return null;
}

export type CollectionPublishedFilter = 'all' | 'yes' | 'no';
export type CollectionTypeFilter = 'all' | 'custom' | 'smart';
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export interface CollectionListFilters {
  q?: string;
  published?: CollectionPublishedFilter;
  type?: CollectionTypeFilter;
  hasProducts?: CollectionPublishedFilter;
  sort?: CollectionSort;
  page?: number;
  pageSize?: number;
}

export interface CollectionListPage {
  rows: CollectionListRow[];
  /** The filtered total, not the length of `rows`. */
  count: number;
  page: number;
  pageSize: number;
  /**
   * True when the in-memory path hit `COLLECTION_SCAN_LIMIT`, so the total is a
   * count over the scanned window and rows beyond it were not considered. The
   * page renders a note rather than showing a quietly short list.
   */
  truncated: boolean;
}

/**
 * Upper bound for the in-memory filter/sort path (`hasProducts`, `sort=products`).
 * The catalog holds tens of collections; this is a guard, not a target size.
 */
export const COLLECTION_SCAN_LIMIT = 2000;

export function toCollectionRow(seed: CollectionSeed, productCount: number): CollectionListRow {
  return {
    ...seed,
    productCount,
    isAuto: isAutoCollectionHandle(seed.handle),
    coverUrl: displayableCoverUrl(seed.storage_image_url, seed.image_src),
  };
}

/** `hasProducts` + `sort=products` (the two orderings that need the counts). */
export function filterAndSortCollections(
  rows: CollectionListRow[],
  filters: Pick<CollectionListFilters, 'hasProducts' | 'sort'>,
): CollectionListRow[] {
  let shaped = rows;
  if (filters.hasProducts === 'yes') {
    shaped = shaped.filter((row) => row.productCount > 0);
  } else if (filters.hasProducts === 'no') {
    shaped = shaped.filter((row) => row.productCount === 0);
  }
  if (filters.sort === 'products') {
    // Stable within equal counts (title A–Z) so paging cannot reshuffle ties.
    shaped = [...shaped].sort(
      (a, b) => b.productCount - a.productCount || a.title.localeCompare(b.title),
    );
  }
  return shaped;
}

/** Slice a filtered row set into the requested page. `count` is the filtered total. */
export function pageCollections(
  rows: CollectionListRow[],
  page: number,
  pageSize: number,
): { rows: CollectionListRow[]; count: number; page: number } {
  const safePage = clampPage(page);
  const { from, to } = pageRange(safePage, pageSize);
  return { rows: rows.slice(from, to + 1), count: rows.length, page: safePage };
}
