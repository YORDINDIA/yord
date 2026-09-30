import 'server-only';

import type { Location, ProductVariant } from '@yord/db-types';
import { PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { reader, rows, runPage, type Paged } from './client';

const ENTITY = 'product_variants';

/**
 * Upper bound on products resolved for a name search before building the
 * `in (...)` filter. High enough that a realistic admin search term matches
 * everything it should, low enough that a single-letter query cannot produce a
 * multi-thousand-id filter string.
 */
const MAX_PRODUCT_SEARCH_IDS = 500;

export interface InventoryRow {
  variant: Pick<
    ProductVariant,
    'id' | 'title' | 'inventory_quantity' | 'price'
  >;
  product: { id: number; title: string; handle: string } | null;
}

/**
 * Paged inventory list, lowest stock first.
 *
 * The old page fetched `.limit(100)` variants and paginated nothing, so the
 * 101st variant was invisible. The inner product join is loaded as a separate
 * typed query instead of a `product:products!inner(...)` embed, which PostgREST
 * cannot type here.
 */
export async function listInventory(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<InventoryRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('product_variants')
    .select('id, product_id, title, inventory_quantity, price', { count: 'exact' })
    .order('inventory_quantity', { ascending: true })
    .range(from, to);

  if (search) {
    // Searching product names takes two queries.
    //
    // The obvious one-liner — `.or('title.ilike.%x%,products.title.ilike.%x%')` —
    // does not work: PostgREST cannot filter on a column of an embedded resource
    // unless it is also embedded, and embedding products would drop the
    // `product_variants` filter entirely (inner join). That was the original bug
    // here: the product-name half of the search silently did nothing.
    //
    // A foreign-table filter would be the other option, but it needs a database
    // view the migration would have to create. Resolving the ids first keeps this
    // in the data layer and works on the existing schema.
    const matched = await rows<{ id: number }>(
      'products',
      supabase
        .from('products')
        .select('id')
        .ilike('title', `%${search}%`)
        // Bounds the `in` list below. An admin typing a common word could
        // otherwise match thousands of products and build a very long filter.
        .limit(MAX_PRODUCT_SEARCH_IDS),
    );
    const productIds = matched.map((row) => row.id);

    // A term matching no product at all would produce an empty `in ()`, which
    // PostgREST rejects, so fall back to the variant-title half on its own.
    if (productIds.length === 0) {
      request = request.ilike('title', `%${search}%`);
    } else {
      request = request.or(
        `title.ilike.%${search}%,product_id.in.(${productIds.join(',')})`,
      );
    }
  }

  const result = await runPage<
    Pick<
      ProductVariant,
      'id' | 'product_id' | 'title' | 'inventory_quantity' | 'price'
    >
  >(ENTITY, request);

  const productIds = [...new Set(result.rows.map((row) => row.product_id))];
  const products = productIds.length
    ? await rows<{ id: number; title: string; handle: string }>(
        'products',
        supabase.from('products').select('id, title, handle').in('id', productIds),
      )
    : [];
  const byId = new Map(products.map((product) => [product.id, product]));

  return {
    ...result,
    rows: result.rows.map((row) => ({
      variant: {
        id: row.id,
        title: row.title,
        inventory_quantity: row.inventory_quantity,
        price: row.price,
      },
      product: byId.get(row.product_id) ?? null,
    })),
    page,
    pageSize,
  };
}

/** Every fulfillment/stock point. Small table; unpaged. */
export async function listLocations(): Promise<Location[]> {
  const supabase = await reader();
  return rows<Location>(
    'locations',
    supabase.from('locations').select('*').order('name', { ascending: true }),
  );
}
