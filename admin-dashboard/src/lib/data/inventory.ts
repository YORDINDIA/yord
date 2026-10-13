import 'server-only';

import { cache } from 'react';
import type { Location, ProductVariant } from '@yord/db-types';
import { LOW_STOCK_THRESHOLD, PAGE_SIZE } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { coversForProducts } from './covers';
import { reader, rows, runCount, runPage, uniqueIds, type Paged } from './client';

const ENTITY = 'product_variants';

/**
 * Upper bound on products resolved for a name search before building the
 * `in (...)` filter. High enough that a realistic admin search term matches
 * everything it should, low enough that a single-letter query cannot produce a
 * multi-thousand-id filter string.
 */
const MAX_PRODUCT_SEARCH_IDS = 500;

/**
 * Stock states the list can filter to. The predicates match
 * `analytics.getInventoryHealth()` exactly, so the strip, the tabs, and the
 * sidebar badge cannot disagree:
 *
 *   | filter      | predicate                                          |
 *   |-------------|----------------------------------------------------|
 *   | `low`       | `1 … LOW_STOCK_THRESHOLD`                          |
 *   | `out`       | `<= 0` (a negative quantity is oversold, still out) |
 *   | `untracked` | `IS NULL`                                          |
 */
export const INVENTORY_STOCKS = ['low', 'out', 'untracked'] as const;
export type InventoryStock = (typeof INVENTORY_STOCKS)[number];

/**
 * Orders the variant list can be read in. `quantity` (lowest first) is the
 * default and the only order the page supported before.
 *
 * There is no "total inventory value" order: that would sort by
 * `quantity * price`, and PostgREST only orders by a column. The strip's
 * inventory-value KPI is a sum, not an order, so the closest honest option is
 * unit price descending.
 */
export const INVENTORY_SORTS = ['quantity', 'quantity-desc', 'price-desc', 'updated'] as const;
export type InventorySort = (typeof INVENTORY_SORTS)[number];

export interface InventoryRow {
  variant: Pick<
    ProductVariant,
    'id' | 'title' | 'sku' | 'inventory_quantity' | 'price' | 'updated_at'
  >;
  product: { id: number; title: string; handle: string | null } | null;
  /** Product cover (`storage_url` then `src`); null when the product has no image. */
  imageUrl: string | null;
}

/** Columns the list reads before the product join is attached. */
type VariantSeed = Pick<
  ProductVariant,
  | 'id'
  | 'product_id'
  | 'title'
  | 'sku'
  | 'inventory_quantity'
  | 'price'
  | 'updated_at'
>;

/**
 * Paged inventory list, lowest stock first by default.
 *
 * The old page fetched `.limit(100)` variants and paginated nothing, so the
 * 101st variant was invisible. The inner product join is loaded as a separate
 * typed query instead of a `product:products!inner(...)` embed, which PostgREST
 * cannot type here.
 *
 * The stock filter and the search both run before `.range()`, so `count` and the
 * pager stay in sync with the rows actually shown. `id` is the secondary order
 * key: without a tiebreak, PostgREST is free to return equal-quantity rows in a
 * different order per request, and a row could then repeat or vanish when the
 * admin pages.
 */
export async function listInventory(filters: {
  q?: string;
  stock?: InventoryStock;
  sort?: InventorySort;
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
    .select('id, product_id, title, sku, inventory_quantity, price, updated_at', {
      count: 'exact',
    })
    .order(orderColumn(filters.sort), { ascending: isAscending(filters.sort) })
    .order('id', { ascending: true })
    .range(from, to);

  switch (filters.stock) {
    case 'low':
      request = request.gt('inventory_quantity', 0).lte('inventory_quantity', LOW_STOCK_THRESHOLD);
      break;
    case 'out':
      request = request.lte('inventory_quantity', 0);
      break;
    case 'untracked':
      request = request.is('inventory_quantity', null);
      break;
    default:
      break;
  }

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
    const matchedIds = matched.map((row) => row.id);

    // A term matching no product at all would produce an empty `in ()`, which
    // PostgREST rejects, so fall back to the variant-title half on its own.
    if (matchedIds.length === 0) {
      request = request.ilike('title', `%${search}%`);
    } else {
      request = request.or(
        `title.ilike.%${search}%,product_id.in.(${matchedIds.join(',')})`,
      );
    }
  }

  const result = await runPage<VariantSeed>(ENTITY, request);

  const productIds = uniqueIds(result.rows.map((row) => row.product_id));
  const [products, covers] = await Promise.all([
    // An empty `in ()` is rejected by PostgREST, so skip the query entirely.
    productIds.length
      ? rows<{ id: number; title: string; handle: string | null }>(
          'products',
          supabase.from('products').select('id, title, handle').in('id', productIds),
        )
      : Promise.resolve([]),
    // One bounded query for every cover on the page, shared with the dashboard
    // and analytics; never one image query per row.
    coversForProducts(productIds),
  ]);
  const byId = new Map(products.map((product) => [product.id, product]));

  return {
    ...result,
    rows: result.rows.map((row) => ({
      variant: {
        id: row.id,
        title: row.title,
        sku: row.sku,
        inventory_quantity: row.inventory_quantity,
        price: row.price,
        updated_at: row.updated_at,
      },
      product: byId.get(row.product_id) ?? null,
      imageUrl: covers.get(row.product_id) ?? null,
    })),
    page,
    pageSize,
  };
}

function orderColumn(sort: InventorySort | undefined): 'inventory_quantity' | 'price' | 'updated_at' {
  switch (sort) {
    case 'price-desc':
      return 'price';
    case 'updated':
      return 'updated_at';
    default:
      return 'inventory_quantity';
  }
}

function isAscending(sort: InventorySort | undefined): boolean {
  return sort === 'quantity' || sort === undefined;
}

export interface InventoryStats {
  /** Every variant row. */
  total: number;
  /** `inventory_quantity <= 0`, which includes oversold negatives. */
  out: number;
  /** `1 … LOW_STOCK_THRESHOLD`. */
  low: number;
  /** Above `LOW_STOCK_THRESHOLD`. */
  healthy: number;
  /** NULL quantity — "not counted yet", never folded into `healthy`. */
  untracked: number;
  /** Σ `max(quantity, 0) × price` over tracked variants, in store currency. */
  value: number;
}

/**
 * Variant counts for the inventory strip, as five head-only counts plus one
 * value read, all in parallel.
 *
 * The four buckets are disjoint and cover the table exactly, so
 * `total = healthy + low + out + untracked` — the same split the dashboard and
 * the sidebar badge use, which is why the predicates are kept in step with
 * `analytics.getInventoryHealth()` rather than re-derived here.
 *
 * Counts are head-only, so the strip costs the same on a 50-variant catalog and
 * a 50k one. The value is different: PostgREST cannot `SUM`, so it is the one
 * read that has to touch rows — see `inventoryValue()`.
 */
export const getInventoryStats = cache(async (): Promise<InventoryStats> => {
  const supabase = await reader();

  const [total, out, low, healthy, untracked, value] = await Promise.all([
    runCount(
      ENTITY,
      supabase.from('product_variants').select('id', { count: 'exact', head: true }),
    ),
    runCount(
      ENTITY,
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .lte('inventory_quantity', 0),
    ),
    runCount(
      ENTITY,
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .gt('inventory_quantity', 0)
        .lte('inventory_quantity', LOW_STOCK_THRESHOLD),
    ),
    runCount(
      ENTITY,
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .gt('inventory_quantity', LOW_STOCK_THRESHOLD),
    ),
    runCount(
      ENTITY,
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .is('inventory_quantity', null),
    ),
    inventoryValue(supabase),
  ]);

  return { total, out, low, healthy, untracked, value };
});

/** Rows per response when summing inventory value; PostgREST caps one at 1,000. */
const VALUE_WINDOW = 1000;

/**
 * Hard stop on the value read. A catalog this large would need the aggregate to
 * move into SQL; until then the number is clamped rather than unbounded.
 */
const MAX_VALUE_ROWS = 20_000;

/**
 * Σ `max(quantity, 0) × price` over every tracked variant.
 *
 * Paged in 1,000-row windows in a stable `id` order and summed in JS, the same
 * shape `products.listLowStockProductIds()` uses — a single request would be
 * truncated at the response cap and quietly under-report the total. Untracked
 * (NULL) and oversold (≤ 0) variants count as zero: neither holds stock, and a
 * negative quantity must not subtract from the value of the catalog.
 */
async function inventoryValue(supabase: Awaited<ReturnType<typeof reader>>): Promise<number> {
  let value = 0;

  for (let from = 0; from < MAX_VALUE_ROWS; from += VALUE_WINDOW) {
    const page = await rows<Pick<ProductVariant, 'price' | 'inventory_quantity'>>(
      'product_variants',
      supabase
        .from('product_variants')
        .select('price, inventory_quantity')
        .gt('inventory_quantity', 0)
        .order('id', { ascending: true })
        .range(from, from + VALUE_WINDOW - 1),
    );

    for (const row of page) {
      value += Number(row.price ?? 0) * Math.max(Number(row.inventory_quantity ?? 0), 0);
    }

    if (page.length < VALUE_WINDOW) break;
  }

  return value;
}

/** Every fulfillment/stock point. Small table; unpaged. */
export async function listLocations(): Promise<Location[]> {
  const supabase = await reader();
  return rows<Location>(
    'locations',
    supabase.from('locations').select('*').order('name', { ascending: true }),
  );
}
