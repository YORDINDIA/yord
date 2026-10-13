import 'server-only';

import { reader, rows } from './client';

/** A `product_images` row, narrowed to the two URL columns and the sort key. */
interface CoverRow {
  product_id: number | null;
  storage_url: string | null;
  src: string | null;
  position: number | null;
}

/**
 * First image per product id, in one bounded query.
 *
 * Shared by every surface that shows a product next to non-product data —
 * dashboard low-stock lists, analytics top products, order line items — so a
 * row of images costs one query rather than one per product.
 *
 * Products are ordered by `position` (lowest first, matching the cover choice
 * in `products.ts`); a product whose images are all URL-less is simply absent
 * from the map, and callers fall back to `Thumb`'s placeholder icon.
 */
export async function coversForProducts(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))];
  const covers = new Map<number, string>();
  if (unique.length === 0) return covers;

  const supabase = await reader();
  const data = await rows<CoverRow>(
    'product_images',
    supabase
      .from('product_images')
      .select('product_id, storage_url, src, position')
      .in('product_id', unique)
      .order('position', { ascending: true }),
  );

  for (const row of data) {
    const id = row.product_id;
    if (id === null || covers.has(id)) continue;
    const url = row.storage_url ?? row.src;
    if (url) covers.set(id, url);
  }

  return covers;
}
