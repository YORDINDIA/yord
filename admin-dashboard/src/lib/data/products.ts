import 'server-only';

import { cache } from 'react';
import type { Collect, Product, ProductImage, ProductVariant } from '@yord/db-types';
import { LOW_STOCK_THRESHOLD, PAGE_SIZE, PRODUCT_STATUSES, isOneOf } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { groupBy, one, reader, rows, runCount, runPage, uniqueIds, type Paged } from './client';

const ENTITY = 'products';

/** Columns the catalog list needs before variant/image columns are attached. */
interface ProductSeed {
  id: number;
  title: string;
  handle: string | null;
  status: string | null;
  tags: string | null;
  updated_at: string | null;
  price?: number;
  inventory?: number;
  imageUrl?: string | null;
}

export interface ProductListFilters {
  q?: string;
  status?: string;
  stock?: 'all' | 'low';
  sort?: 'updated_at' | 'title';
  page?: number;
  pageSize?: number;
}

/**
 * One catalog row: seed columns plus the derived price/stock/cover.
 *
 * `price`/`inventory` are the *first* variant's values (kept as-is: the CSV
 * export and the collection picker read them). `compareAtPrice`,
 * `variantCount` and `totalInventory` are additive so the table can show the
 * compare-at strike-through, the variant count, and the whole product's stock.
 */
export type ProductListRow = ProductSeed & {
  price: number;
  inventory: number;
  /** First variant's compare-at price; `null` when it has none. */
  compareAtPrice: number | null;
  /** Number of variants attached to the product. */
  variantCount: number;
  /** Sum of `inventory_quantity` across every variant. */
  totalInventory: number;
  imageUrl: string | null;
};

/**
 * Paged catalog listing with server-side filtering.
 *
 * Search and the low-stock filter both run before `.range()`, so `count` and the
 * pager stay in sync with the rows actually shown. The low-stock membership
 * query is unbounded: it previously fetched at most 100 variants, so products
 * whose low-stock variants sat past row 100 were silently excluded.
 */
export async function listProducts(filters: ProductListFilters): Promise<Paged<ProductListRow>> {
  const supabase = await reader();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);
  const search = sanitizeSearch(filters.q);

  let request = supabase
    .from('products')
    .select('id, title, handle, status, tags, updated_at', { count: 'exact' })
    .order(filters.sort === 'title' ? 'title' : 'updated_at', {
      ascending: filters.sort === 'title',
    });

  if (isOneOf(PRODUCT_STATUSES, filters.status)) {
    request = request.eq('status', filters.status);
  }
  if (search) {
    request = request.or(
      `title.ilike.%${search}%,handle.ilike.%${search}%,tags.ilike.%${search}%`,
    );
  }
  if (filters.stock === 'low') {
    const lowStock = await listLowStockProductIds();
    // -1 can never match a bigint id, so the empty case still issues a query.
    request = request.in('id', lowStock.length > 0 ? lowStock : [-1]);
  }
  request = request.range(from, to);

  const pageResult = await runPage<ProductSeed>(ENTITY, request);
  const enriched = await attachListDerivedFields(pageResult.rows);

  return { ...pageResult, rows: enriched, page, pageSize };
}

async function attachListDerivedFields(rowsIn: ProductSeed[]): Promise<ProductListRow[]> {
  if (rowsIn.length === 0) return [];
  const ids = rowsIn.map((row) => row.id);
  const supabase = await reader();

  const [variants, images] = await Promise.all([
    rows<
      Pick<
        ProductVariant,
        'product_id' | 'position' | 'price' | 'compare_at_price' | 'inventory_quantity'
      >
    >(
      'product_variants',
      supabase
        .from('product_variants')
        .select('product_id, position, price, compare_at_price, inventory_quantity')
        .in('product_id', ids)
        .order('position', { ascending: true }),
    ),
    rows<Pick<ProductImage, 'product_id' | 'position' | 'storage_url' | 'src'>>(
      'product_images',
      supabase
        .from('product_images')
        .select('product_id, position, storage_url, src')
        .in('product_id', ids)
        .order('position', { ascending: true }),
    ),
  ]);

  const variantsByProduct = groupBy(variants, (v) => v.product_id);
  const imagesByProduct = groupBy(images, (img) => img.product_id);

  return rowsIn.map((row) => {
    const productVariants = variantsByProduct.get(row.id) ?? [];
    const first = productVariants[0];
    const cover = imagesByProduct.get(row.id)?.[0];
    return {
      ...row,
      price: Number(first?.price ?? 0),
      inventory: Number(first?.inventory_quantity ?? 0),
      compareAtPrice:
        first?.compare_at_price === null || first?.compare_at_price === undefined
          ? null
          : Number(first.compare_at_price),
      variantCount: productVariants.length,
      totalInventory: productVariants.reduce(
        (sum, variant) => sum + Number(variant.inventory_quantity ?? 0),
        0,
      ),
      imageUrl: cover?.storage_url ?? cover?.src ?? null,
    };
  });
}

/** Every product id with at least one variant at or below the threshold. */
export async function listLowStockProductIds(): Promise<number[]> {
  const supabase = await reader();
  // A single response is capped at 1,000 rows: products whose low-stock
  // variants sit past the cap were silently excluded from the filter and the
  // count, so page through the whole match set in stable order.
  const ids: number[] = [];
  const WINDOW = 1000;
  for (let from = 0; ; from += WINDOW) {
    const page = await rows<{ product_id: number }>(
      'product_variants',
      supabase
        .from('product_variants')
        .select('product_id')
        .or(`inventory_quantity.lte.${LOW_STOCK_THRESHOLD},inventory_quantity.is.null`)
        .order('product_id', { ascending: true })
        .range(from, from + WINDOW - 1),
    );
    for (const row of page) ids.push(row.product_id);
    if (page.length < WINDOW) break;
  }
  return uniqueIds(ids);
}

/** Catalog-wide KPI numbers for the products stat strip. */
export interface ProductStats {
  /** Every product row, any status. */
  total: number;
  active: number;
  draft: number;
  archived: number;
  /** Variants at or below the low-stock threshold (NULL counts as zero). */
  lowStock: number;
}

/**
 * Catalog counts for the list page's stat strip, in five head-only reads.
 *
 * `lowStock` is variant-level and uses the same predicate as the sidebar badge
 * (`getNavBadges`) and the dashboard KPI, so the three surfaces cannot disagree
 * — including the NULL arm, which the inventory UI renders as zero.
 * The status counts are separate head counts rather than a scan of every
 * product, so the strip costs the same on a 50-product catalog and a 50k one.
 */
export const getProductStats = cache(async (): Promise<ProductStats> => {
  const supabase = await reader();
  const countStatus = (status: (typeof PRODUCT_STATUSES)[number]) =>
    runCount(
      ENTITY,
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', status),
    );

  const [total, active, draft, archived, lowStock] = await Promise.all([
    runCount(ENTITY, supabase.from('products').select('id', { count: 'exact', head: true })),
    countStatus('active'),
    countStatus('draft'),
    countStatus('archived'),
    runCount(
      'product_variants',
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .or(`inventory_quantity.lte.${LOW_STOCK_THRESHOLD},inventory_quantity.is.null`),
    ),
  ]);

  return { total, active, draft, archived, lowStock };
});

export interface ProductDetail {
  product: Product;
  variants: ProductVariant[];
  images: ProductImage[];
}

/**
 * One product with variants and images. `null` when the id does not exist (the
 * page calls `notFound()`); throws `DatabaseError` when the read failed.
 */
export const getProduct = cache(async (id: number): Promise<ProductDetail | null> => {
  const supabase = await reader();
  const product = await one<Product>(
    ENTITY,
    supabase.from('products').select('*').eq('id', id).limit(1).maybeSingle(),
  );
  if (!product) return null;

  const [variants, images] = await Promise.all([
    rows<ProductVariant>(
      'product_variants',
      supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .order('position', { ascending: true }),
    ),
    rows<ProductImage>(
      'product_images',
      supabase
        .from('product_images')
        .select('*')
        .eq('product_id', id)
        .order('position', { ascending: true }),
    ),
  ]);

  return { product, variants, images };
});

/** One collection a product belongs to, for the detail page's meta card. */
export interface ProductCollectionLink {
  id: number;
  title: string;
  handle: string | null;
  published: boolean | null;
}

/**
 * Collections a product is a member of, alphabetical.
 *
 * Two bounded reads (membership rows, then the collections they name) instead of
 * an embedded `collects(collections(...))` select the generated types do not
 * cover. Membership is paged like every other `collects` read, since a product
 * can sit in more than one 1,000-row response window.
 */
export async function listProductCollections(
  productId: number,
): Promise<ProductCollectionLink[]> {
  const supabase = await reader();
  const WINDOW = 1000;
  const collectionIds: number[] = [];
  for (let from = 0; ; from += WINDOW) {
    const page = await rows<Pick<Collect, 'collection_id'>>(
      'collects',
      supabase
        .from('collects')
        .select('collection_id')
        .eq('product_id', productId)
        .order('collection_id', { ascending: true })
        .range(from, from + WINDOW - 1),
    );
    for (const row of page) collectionIds.push(row.collection_id);
    if (page.length < WINDOW) break;
  }

  const ids = uniqueIds(collectionIds);
  if (ids.length === 0) return [];
  return rows<ProductCollectionLink>(
    ENTITY,
    supabase
      .from('collections')
      .select('id, title, handle, published')
      .in('id', ids)
      .order('title', { ascending: true }),
  );
}

/** Product id/title pairs for pickers. Paged, never capped at an arbitrary 50. */
export async function listProductOptions(
  search?: string,
  limit = 200,
): Promise<{ id: number; title: string }[]> {
  const supabase = await reader();
  const safe = sanitizeSearch(search);
  let request = supabase
    .from('products')
    .select('id, title')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (safe) request = request.or(`title.ilike.%${safe}%`);
  const result = await runPage<{ id: number; title: string }>(ENTITY, request);
  return result.rows;
}

/** Cover image id + url for a product, used by the AI listing studio. */
export async function getCoverImage(
  productId: number,
): Promise<{ id: number; url: string } | null> {
  const supabase = await reader();
  const result = await rows<{
    id: number;
    storage_url: string | null;
    src: string | null;
  }>(
    'product_images',
    supabase
      .from('product_images')
      .select('id, storage_url, src')
      .eq('product_id', productId)
      .order('position', { ascending: true })
      .limit(1),
  );
  const row = result[0];
  if (!row) return null;
  const url = row.storage_url ?? row.src;
  return url ? { id: row.id, url } : null;
}

/** Light row for the collection product picker (search results and members). */
export interface ProductPickerRow {
  id: number;
  title: string;
  status: string | null;
  price: number;
  imageUrl: string | null;
}

/** Columns the picker query needs before variants/images are attached. */
type PickerSeed = Pick<Product, 'id' | 'title' | 'status'>;

/**
 * Search for the collection product picker.
 *
 * A thin wrapper over `listProducts` so the picker, the catalog table and the
 * CSV export cannot drift apart: same sanitizer, same `ilike` columns, same
 * paging, same total. The old collection form asked the admin to type raw
 * bigint ids into a text box, which is unusable with 463 products.
 */
export async function searchProductsForPicker(filters: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<ProductPickerRow>> {
  const result = await listProducts({
    q: filters.q,
    status: filters.status,
    stock: 'all',
    sort: 'updated_at',
    page: filters.page,
    pageSize: filters.pageSize,
  });
  return result;
}

/**
 * Light rows for an explicit id list, in the submitted order, for the picker's
 * initial selection. Unknown ids are dropped rather than breaking the read.
 */
export async function listProductPickerRows(ids: number[]): Promise<ProductPickerRow[]> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return [];
  const supabase = await reader();
  const CHUNK = 150;
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));

  const results = await Promise.all(
    chunks.map((chunk) =>
      rows<PickerSeed>(
        ENTITY,
        supabase.from('products').select('id, title, status').in('id', chunk),
      ),
    ),
  );
  const seeds = results.flat();
  // attachListDerivedFields wants ProductSeed; the picker only needs the
  // derived price/cover, so reuse the same shape with the fields it reads.
  const enriched = await attachListDerivedFields(
    seeds.map((seed) => ({ ...seed, handle: null, tags: null, updated_at: null })),
  );
  const byId = new Map(enriched.map((row) => [row.id, row]));
  // Preserve the submitted order (collects.position), not id order.
  return unique
    .map((id) => byId.get(id))
    .filter((row): row is ProductListRow => Boolean(row))
    .map(({ id, title, status, price, imageUrl }) => ({ id, title, status, price, imageUrl }));
}
