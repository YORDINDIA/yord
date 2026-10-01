import 'server-only';

import { cache } from 'react';
import type { Product, ProductImage, ProductVariant } from '@yord/db-types';
import { LOW_STOCK_THRESHOLD, PAGE_SIZE, PRODUCT_STATUSES, isOneOf } from '@/lib/constants';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import { groupBy, one, reader, rows, runPage, uniqueIds, type Paged } from './client';

const ENTITY = 'products';

/** Columns the catalog list needs before variant/image columns are attached. */
interface ProductSeed {
  id: number;
  title: string;
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

/** One catalog row: seed columns plus the derived price/inventory/cover. */
export type ProductListRow = ProductSeed & {
  price: number;
  inventory: number;
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
    .select('id, title, status, tags, updated_at', { count: 'exact' })
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
    rows<Pick<ProductVariant, 'product_id' | 'position' | 'price' | 'inventory_quantity'>>(
      'product_variants',
      supabase
        .from('product_variants')
        .select('product_id, position, price, inventory_quantity')
        .in('product_id', ids)
        .order('position', { ascending: true }),
    ),
    rows<Pick<ProductImage, 'product_id' | 'position' | 'supabase_url' | 'src'>>(
      'product_images',
      supabase
        .from('product_images')
        .select('product_id, position, supabase_url, src')
        .in('product_id', ids)
        .order('position', { ascending: true }),
    ),
  ]);

  const variantsByProduct = groupBy(variants, (v) => v.product_id);
  const imagesByProduct = groupBy(images, (img) => img.product_id);

  return rowsIn.map((row) => {
    const first = variantsByProduct.get(row.id)?.[0];
    const cover = imagesByProduct.get(row.id)?.[0];
    return {
      ...row,
      price: Number(first?.price ?? 0),
      inventory: Number(first?.inventory_quantity ?? 0),
      imageUrl: cover?.supabase_url ?? cover?.src ?? null,
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
    supabase_url: string | null;
    src: string | null;
  }>(
    'product_images',
    supabase
      .from('product_images')
      .select('id, supabase_url, src')
      .eq('product_id', productId)
      .order('position', { ascending: true })
      .limit(1),
  );
  const row = result[0];
  if (!row) return null;
  const url = row.supabase_url ?? row.src;
  return url ? { id: row.id, url } : null;
}
