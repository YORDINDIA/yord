import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRICE_SORT_FETCH_LIMIT,
  catalogOrder,
  compareCatalogProducts,
  sortProductsByPrice,
} from '@/lib/product';
import { DatabaseError, postgrestCodeOf } from '@/lib/errors';
import { logDbError } from '@/lib/logger';
import type { ProductWithDetails } from '@yord/db-types';
import type { SortOption } from '@/lib/product';

/** Id-list fetch shares the single catalog sort vocabulary. */
export type IdsSort = SortOption;

/** True when the products.min_price cache is usable for SQL ordering. */
function hasMinPrice(row: ProductWithDetails): boolean {
  // Absent cache is not a price: Number(null)/Number('') is 0, which would
  // fake a free product and skip the variant-price fallback below.
  const raw = (row as { min_price?: unknown }).min_price;
  if (raw == null || raw === '') return false;
  return Number.isFinite(Number(raw));
}

/**
 * Single shared product select. Superset (widest) of every catalog query so
 * switching callers to it cannot regress UI fields: detail pages need
 * variant sku/barcode/policy + image dimensions + product_options, list
 * pages simply ignore the extra columns.
 */
export const PRODUCT_SELECT = `
  *,
  product_variants (
    id, title, price, compare_at_price, sku, barcode,
    inventory_quantity, inventory_policy,
    option1, option2, option3, position,
    image_id, requires_shipping
  ),
  product_images (
    id, src, storage_url, alt, position, width, height
  ),
  product_options (
    id, name, position, values
  )
`;

const CHUNK = 150;

type SupabaseLike = SupabaseClient;

/**
 * PostgREST answers a `Range` whose offset is past the last row with HTTP 416
 * (`PGRST103`) instead of an empty page, so an out-of-range `?page=` would look
 * like a failed read: the collection page would render its error boundary and
 * `GET /api/products` would answer 500. Callers use this to recognise that case
 * and re-issue the identical query with `range(0, 0)`, whose `count` header is
 * the real total — see `fetchProductsByIds` and `fetchAutoCollectionPage`.
 */
export function isRangePastEnd(error: unknown): boolean {
  return postgrestCodeOf(error) === 'PGRST103';
}

/**
 * Fetch products by id list with chunked `.in()` + global sort + page slice.
 * Single source for the collects -> products two-hop used by collection,
 * artist, and homepage queries on both server and client.
 */
export async function fetchProductsByIds(
  supabase: SupabaseLike,
  ids: number[],
  opts: { sort?: IdsSort; page?: number; pageSize?: number } = {}
): Promise<{ data: ProductWithDetails[]; count: number }> {
  const sort = opts.sort ?? 'newest';
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 12;
  if (ids.length === 0) return { data: [], count: 0 };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const isPriceSort = sort === 'price-asc' || sort === 'price-desc';

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

  const fetchChunk = (chunkIds: number[], rangeFrom: number, rangeTo: number) => {
    let q = supabase
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .in('id', chunkIds)
      .eq('status', 'active');
    // One order definition for every paged list (see `catalogOrder`): the
    // `id desc` tie-break is what stops OFFSET paging from repeating or
    // skipping rows inside a price/title tie group, and it must match the SQL
    // order the JS merge below re-applies.
    for (const clause of catalogOrder(sort)) {
      q = q.order(clause.column, { ascending: clause.ascending, nullsFirst: clause.nullsFirst });
    }
    return q.range(rangeFrom, rangeTo);
  };

  if (sort === 'manual') {
    // `manual` is the collection's `collects.position` order: the caller hands
    // us ids already in that order, and no products-table ORDER BY can express
    // it. So page in JS — fetch every chunk from offset 0 (a chunk holds at
    // most CHUNK ids, far under the response limit, and a `range(0, n)` whose
    // start is 0 can never 416), re-order by the caller's index, then slice.
    const results = await Promise.all(chunks.map((c) => fetchChunk(c, 0, CHUNK - 1)));
    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      logDbError('productsByIds:manual-sort', firstError.error);
      throw new DatabaseError('products', 'Query failed', postgrestCodeOf(firstError.error));
    }
    const all = results.flatMap((r) => ((r.data || []) as ProductWithDetails[]));
    const rank = new Map(ids.map((id, index) => [id, index]));
    // A row the caller listed but that is no longer active (deleted/drafted
    // between the two reads) sorts to the end and is sliced away — it must
    // never displace a real product from the page.
    all.sort((a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length));
    const count = results.reduce((sum, r) => sum + (r.count || 0), 0);
    return { data: all.slice(from, to + 1), count };
  }

  if (isPriceSort) {
    const results = await Promise.all(
      chunks.map((c) => fetchChunk(c, 0, PRICE_SORT_FETCH_LIMIT - 1))
    );
    // Price sorts page in memory, so the SQL range never moves past 0: a 416
    // (PGRST103) here means the chunk has no active products left, i.e. an
    // empty chunk — it contributes no rows and no count, exactly like a chunk
    // that answered with an empty page. Every other error still throws.
    const firstError = results.find((r) => r.error && !isRangePastEnd(r.error));
    if (firstError?.error) {
      logDbError('productsByIds:price-sort', firstError.error);
      throw new DatabaseError('products', 'Query failed', postgrestCodeOf(firstError.error));
    }
    const all = results.flatMap((r) => ((r.data || []) as ProductWithDetails[]));
    const count = results.reduce((sum, r) => sum + (r.count || 0), 0);
    // min_price ordering is authoritative only when every row is backfilled;
    // otherwise re-sort client-side from variant prices so un-backfilled
    // rows land in the right position instead of the NULL tail. Both branches
    // are total orders (min_price/variant price, then id desc).
    const sorted = all.every(hasMinPrice)
      ? all.sort((a, b) => compareCatalogProducts(a, b, sort))
      : sortProductsByPrice(all, sort === 'price-asc' ? 'asc' : 'desc');
    return { data: sorted.slice(from, to + 1), count };
  }

  // Only a single-chunk id list is paged in SQL; a multi-chunk list fetches
  // every chunk from 0 and slices in JS, so its range can never overshoot.
  const pagedInSql = chunks.length === 1;
  const chunkFrom = pagedInSql ? from : 0;
  const results = await Promise.all(chunks.map((c) => fetchChunk(c, chunkFrom, to)));
  const firstError = results.find((r) => r.error);
  if (firstError?.error) {
    // `?page=` beyond the last row: PostgREST 416s instead of answering an
    // empty page, which must read as "this page has nothing", not a failure.
    // The 416 body only mentions the total in prose, so re-issue the identical
    // chunk query for one row: its `count` header is the chunk's total, and a
    // 0-0 range can never overshoot. `from >= count` keeps this from swallowing
    // a 416 that is NOT an out-of-range offset.
    if (pagedInSql && isRangePastEnd(firstError.error)) {
      const probe = await fetchChunk(chunks[0], 0, 0);
      if (!probe.error && from >= (probe.count ?? 0)) {
        return { data: [], count: probe.count ?? 0 };
      }
    }
    logDbError('productsByIds', firstError.error);
    throw new DatabaseError('products', 'Query failed', postgrestCodeOf(firstError.error));
  }
  let merged = results.flatMap((r) => ((r.data || []) as ProductWithDetails[]));
  // Re-sort merged chunks with the same comparator the SQL used, so a
  // multi-chunk page is ordered exactly like a single-chunk one.
  merged = merged.sort((a, b) => compareCatalogProducts(a, b, sort));
  const count = results.reduce((sum, r) => sum + (r.count || 0), 0);
  return { data: pagedInSql ? merged : merged.slice(from, to + 1), count };
}
