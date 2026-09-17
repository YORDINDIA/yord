import type { SupabaseClient } from '@supabase/supabase-js';
import { PRICE_SORT_FETCH_LIMIT, sortProductsByPrice } from '@/lib/utils';
import { logDbError } from '@/lib/logger';
import type { ProductWithDetails } from '@/types/database';

export type IdsSort = 'newest' | 'price-asc' | 'price-desc' | 'title' | 'featured';

/** True when the products.min_price cache is usable for SQL ordering. */
function hasMinPrice(row: ProductWithDetails): boolean {
  const v = Number((row as { min_price?: unknown }).min_price);
  return Number.isFinite(v);
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
    id, src, supabase_url, alt, position, width, height
  ),
  product_options (
    id, name, position, values
  )
`;

const CHUNK = 150;

type SupabaseLike = SupabaseClient;

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
    if (!isPriceSort && sort === 'title') q = q.order('title', { ascending: true });
    else if (isPriceSort) q = q.order('min_price', { ascending: sort === 'price-asc', nullsFirst: false });
    else q = q.order('published_at', { ascending: false });
    return q.range(rangeFrom, rangeTo);
  };

  if (isPriceSort) {
    const results = await Promise.all(
      chunks.map((c) => fetchChunk(c, 0, PRICE_SORT_FETCH_LIMIT - 1))
    );
    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      logDbError('productsByIds:price-sort', firstError.error);
      return { data: [], count: 0 };
    }
    const all = results.flatMap((r) => ((r.data || []) as ProductWithDetails[]));
    const count = results.reduce((sum, r) => sum + (r.count || 0), 0);
    // min_price ordering is authoritative only when every row is backfilled;
    // otherwise re-sort client-side from variant prices so un-backfilled
    // rows land in the right position instead of the NULL tail.
    const sorted = all.every(hasMinPrice)
      ? all.sort((a, b) => {
          const pa = Number((a as { min_price?: unknown }).min_price);
          const pb = Number((b as { min_price?: unknown }).min_price);
          return sort === 'price-asc' ? pa - pb || a.id - b.id : pb - pa || a.id - b.id;
        })
      : sortProductsByPrice(all, sort === 'price-asc' ? 'asc' : 'desc');
    return { data: sorted.slice(from, to + 1), count };
  }

  const chunkFrom = chunks.length === 1 ? from : 0;
  const results = await Promise.all(chunks.map((c) => fetchChunk(c, chunkFrom, to)));
  const firstError = results.find((r) => r.error);
  if (firstError?.error) {
    logDbError('productsByIds', firstError.error);
    return { data: [], count: 0 };
  }
  let merged = results.flatMap((r) => ((r.data || []) as ProductWithDetails[]));
  if (sort === 'title') merged = merged.sort((a, b) => a.title.localeCompare(b.title));
  else {
    merged = merged.sort((a, b) => (a.published_at || '').localeCompare(b.published_at || ''));
    merged = merged.reverse();
  }
  const count = results.reduce((sum, r) => sum + (r.count || 0), 0);
  return { data: chunks.length === 1 ? merged : merged.slice(from, to + 1), count };
}
