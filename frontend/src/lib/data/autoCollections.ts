import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, postgrestCodeOf } from '@/lib/errors';
import { logDbError } from '@/lib/logger';
import { PRODUCT_SELECT, isRangePastEnd } from '@/lib/data/productsByIds';
import type { ProductWithDetails } from '@yord/db-types';
import { catalogOrder, type SortOption } from '@/lib/product';

/**
 * Collections whose membership is computed instead of stored.
 *
 * `new-arrivals` and `all` are linked from the storefront header/footer, so
 * they must never be empty and must never go stale. A `collects` list cannot
 * do that: `all` would need re-seeding on every product add, and New Arrivals
 * would freeze at the day it was seeded. Both are therefore answered from the
 * `products` table directly, ordered newest-first, with the same sort
 * vocabulary, pagination, and `ProductWithDetails` shape as any other
 * collection page — callers cannot tell the difference.
 *
 * The admin panel marks these handles read-only (`AUTO_COLLECTION_HANDLES`
 * lives here so both apps agree on one list).
 */
export const AUTO_COLLECTION_HANDLES = ['new-arrivals', 'all'] as const;

export type AutoCollectionHandle = (typeof AUTO_COLLECTION_HANDLES)[number];

const AUTO_SET: readonly string[] = AUTO_COLLECTION_HANDLES;

export function isAutoCollection(handle: string): handle is AutoCollectionHandle {
  return AUTO_SET.includes(handle);
}

/**
 * `/collections` grid filter. The two auto handles stay reachable by URL, stay
 * in the sitemap (`app/sitemap.ts`) and stay in the header/footer nav — only
 * the grid card list omits them: a computed handle is not a curated
 * collection, and a card for it duplicates an entry the header already
 * carries. Grid-only by design — `getCollections` stays unfiltered for its
 * other callers (sitemap, `generateStaticParams`).
 */
export function isGridListedCollection(handle: string | null | undefined): boolean {
  return typeof handle === 'string' && !AUTO_SET.includes(handle);
}

/**
 * One page of an auto collection, mirroring `fetchProductsByIds`' contract
 * (same select, same sorts, same `range`-based paging) but sourced from
 * `products` rather than an id list. Failure throws `DatabaseError` so the
 * page renders its error boundary instead of an empty catalog.
 */
export async function fetchAutoCollectionPage(
  supabase: SupabaseClient,
  opts: { sort?: SortOption; page?: number; pageSize?: number } = {},
): Promise<{ data: ProductWithDetails[]; count: number }> {
  // `manual` orders `collects.position`, which auto collections have none of
  // (they read `products` directly). New Arrivals / All ship with a real
  // `sort_order`, so this guard only fires if an admin ever set Manual on one;
  // degrade to newest rather than paging a sort nobody can see.
  const sort = opts.sort === 'manual' ? 'newest' : (opts.sort ?? 'newest');
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('status', 'active');

  // `min_price` is backfilled for every row (463/463 verified 2025-10-02), so
  // SQL ordering by it agrees with the price shown on the card. The clause list
  // comes from the shared `catalogOrder` so this path and the collects path
  // page identically — including the `id desc` tie-break that keeps OFFSET
  // paging from repeating or skipping rows inside a price/title tie group.
  for (const clause of catalogOrder(sort)) {
    query = query.order(clause.column, {
      ascending: clause.ascending,
      nullsFirst: clause.nullsFirst,
    });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    // An offset past the last active product makes PostgREST answer 416
    // (PGRST103) instead of an empty page. `?page=40` on 463 products is the
    // "nothing on this page" case, not a failed read — re-issue the same query
    // for one row to read the total from its `count` header and answer with the
    // empty page. `from >= total` keeps a 416 that is not an out-of-range
    // offset a real failure.
    if (isRangePastEnd(error)) {
      const probe = await query.range(0, 0);
      if (!probe.error && from >= (probe.count ?? 0)) {
        return { data: [], count: probe.count ?? 0 };
      }
    }
    logDbError('autoCollections', error);
    throw new DatabaseError('products', 'Query failed', postgrestCodeOf(error));
  }

  return {
    data: (data || []) as unknown as ProductWithDetails[],
    count: count || 0,
  };
}
