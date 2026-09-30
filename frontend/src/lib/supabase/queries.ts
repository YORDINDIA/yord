import { createServerClient, createStaticClient } from './server';
import type { ProductWithDetails, Collection, ArtistData, Article, ArticleWithBlog } from '@yord/db-types';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@yord/db-types';
import { stripHtml } from '@yord/ui';
import { PRICE_SORT_FETCH_LIMIT, sortProductsByPrice } from '@/lib/product';
import type { SortOption } from '@/lib/product';
import { escapeLike } from '@/lib/search';
import { fetchProductsByIds, PRODUCT_SELECT } from '@/lib/data/productsByIds';
import { isSupabaseUnconfigured, queryOrThrow, throwDbError } from '@/lib/result';
import { DatabaseError, postgrestCodeOf } from '@/lib/errors';
import { logDbError } from '@/lib/logger';

/**
 * Storefront reads. Three unambiguous outcomes:
 *
 * - genuinely empty → `[]` (lists) — the query succeeded with 0 rows
 * - missing row     → `null` (single-row reads) — page calls `notFound()`
 * - failed query    → throws `DatabaseError` — nearest `error.tsx` renders
 *
 * `queryOrThrow` logs via `logDbError` and maps PostgREST `PGRST116` to
 * `null`. Nothing here swallows a failure into an empty result.
 */

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Featured products for the homepage.
 * @param limit - max products
 * @param useStatic - use the static client so cacheable pages stay prerenderable
 */
export async function getFeaturedProducts(limit = 8, useStatic = false): Promise<ProductWithDetails[]> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  const data = await queryOrThrow<ProductWithDetails[]>(
    'products:featured',
    'products',
    () => supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(limit),
  );

  return (data || []) as ProductWithDetails[];
}

/**
 * Single product by handle (URL slug), static client for prerendered pages.
 * Missing row → `null` (page calls `notFound()`); failure → throws.
 */
export async function getProductByHandleStatic(handle: string): Promise<ProductWithDetails | null> {
  const supabase = createStaticClient();

  const data = await queryOrThrow<ProductWithDetails>(
    'products:by-handle',
    'products',
    () => supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('handle', handle)
      .eq('status', 'active')
      .single(),
  );

  return data as ProductWithDetails | null;
}

/**
 * Related products (same vendor or product type), excluding the current one.
 * Genuinely empty (vendor-less product, no matches) → `[]`.
 */
export async function getRelatedProducts(
  product: ProductWithDetails,
  limit = 4
): Promise<ProductWithDetails[]> {
  const supabase = await createServerClient();

  // Null vendor/type would interpolate as literal 'null'; fall back to newest
  const filters: string[] = [];
  if (product.vendor) filters.push(`vendor.eq."${escapeFilterValue(product.vendor)}"`);
  if (product.product_type) filters.push(`product_type.eq."${escapeFilterValue(product.product_type)}"`);

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'active')
    .neq('id', product.id);

  if (filters.length > 0) {
    query = query.or(filters.join(','));
  }

  const data = await queryOrThrow<ProductWithDetails[]>(
    'products:related',
    'products',
    () => query.order('published_at', { ascending: false }).limit(limit),
  );

  return (data || []) as ProductWithDetails[];
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/** All published collections. */
export async function getCollections(): Promise<Collection[]> {
  const supabase = await createServerClient();

  const data = await queryOrThrow<Collection[]>(
    'collections:list',
    'collections',
    () => supabase
      .from('collections')
      .select('*')
      .eq('published', true)
      .order('title', { ascending: true }),
  );

  return (data || []) as Collection[];
}

/** Single published collection by handle. Missing → `null`. */
export async function getCollectionByHandle(handle: string): Promise<Collection | null> {
  const supabase = await createServerClient();

  const data = await queryOrThrow<Collection>(
    'collections:by-handle',
    'collections',
    () => supabase
      .from('collections')
      .select('*')
      .eq('handle', handle)
      .eq('published', true)
      .maybeSingle(),
  );

  return data as Collection | null;
}

/**
 * All published collections (static version for generateStaticParams).
 * Build-time enumeration degrades to `[]` so a catalog hiccup during the
 * build does not fail it; request-time reads throw instead.
 */
export async function getCollectionsStatic(): Promise<Collection[]> {
  try {
    const supabase = createStaticClient();

    const data = await queryOrThrow<Collection[]>(
      'collections:list-static',
      'collections',
      () => supabase
        .from('collections')
        .select('*')
        .eq('published', true)
        .order('title', { ascending: true }),
    );
    return (data || []) as Collection[];
  } catch {
    return [];
  }
}

/**
 * Single collection by handle (static version for generateMetadata).
 * Missing row → `null`; failure → throws (page renders `error.tsx`, not 404).
 */
export async function getCollectionByHandleStatic(handle: string): Promise<Collection | null> {
  const supabase = createStaticClient();

  const data = await queryOrThrow<Collection>(
    'collections:by-handle-static',
    'collections',
    () => supabase
      .from('collections')
      .select('*')
      .eq('handle', handle)
      .eq('published', true)
      .maybeSingle(),
  );

  return data as Collection | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Unique product types/categories. */
export async function getProductTypes(): Promise<string[]> {
  const supabase = await createServerClient();

  const data = await queryOrThrow<{ product_type: string | null }[]>(
    'products:types',
    'products',
    () => supabase
      .from('products')
      .select('product_type')
      .eq('status', 'active')
      .not('product_type', 'is', null),
  );

  const types = [...new Set((data || []).map(p => p.product_type).filter(Boolean))] as string[];
  return types.sort();
}

type ArtistCollectionRow = {
  id: number;
  title: string;
  handle: string | null;
  body_html: string | null;
  image_src: string | null;
};

function toArtistData(
  col: ArtistCollectionRow,
  productCount: number,
): ArtistData {
  // Get static metadata for colors, images, etc.
  const handle = col.handle || '';
  const staticData = ARTISTS[handle];

  return {
    handle,
    vendorName: col.title, // Use collection title as display name
    name: staticData?.name || col.title,
    tagline: staticData?.tagline || 'Official Merchandise',
    bio: (col.body_html ? stripHtml(col.body_html) : '') || staticData?.bio || `Shop exclusive ${col.title} merchandise.`,
    heroImage: col.image_src || staticData?.heroImage,
    logoImage: staticData?.logoImage,
    accentColor: staticData?.accentColor || '#FFD700',
    secondaryColor: staticData?.secondaryColor || '#1C1C1C',
    productCount,
  } as ArtistData;
}

/**
 * Artists with metadata and product counts.
 * Queries artist collections and their linked products via collects table.
 * @param useStatic - Use static client for build-time generation (no cookies).
 *   Build-time enumeration degrades to `[]`; request-time reads throw.
 */
export async function getArtistsWithMetadata(useStatic = false): Promise<ArtistData[]> {
  try {
    const supabase = useStatic ? createStaticClient() : await createServerClient();

    // Get artist collections
    const collections = await queryOrThrow<ArtistCollectionRow[]>(
      'artists:collections',
      'collections',
      () => supabase
        .from('collections')
        .select('id, title, handle, body_html, image_src')
        .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]),
    );

    if (!collections) return [];

    // Get product counts for all artist collections in ONE query (not N+1)
    const collectionIds = (collections as { id: number }[]).map((c) => c.id);
    const collects = await queryOrThrow<{ collection_id: number }[]>(
      'artists:collects',
      'collects',
      () => supabase
        .from('collects')
        .select('collection_id')
        .in('collection_id', collectionIds),
    );
    const counts = new Map<number, number>();
    for (const row of collects || []) {
      counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1);
    }

    return collections
      .map((col) => toArtistData(col, counts.get(col.id) || 0))
      .filter(a => a.productCount && a.productCount > 0)
      .sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
  } catch (error) {
    // Build-time enumeration must not fail the build; request-time reads throw.
    if (useStatic) return [];
    throw error;
  }
}

/**
 * Single artist by handle — collection data combined with static metadata.
 * Missing row → `null` (page calls `notFound()`); failure → throws.
 * @param handle - The artist handle (e.g., 'coldplay')
 * @param useStatic - Use static client for build-time generation (no cookies)
 */
export async function getArtistByHandle(handle: string, useStatic = false): Promise<ArtistData | null> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  const collection = await queryOrThrow<ArtistCollectionRow>(
    'artists:by-handle',
    'collections',
    () => supabase
      .from('collections')
      .select('id, title, handle, body_html, image_src')
      .eq('handle', handle)
      .single(),
  );

  if (!collection) return null;

  // Get product count — a failed count is a failed read, not "zero products".
  const { count, error: countError } = await supabase
    .from('collects')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collection.id);
  if (countError) {
    logDbError('artists:count', countError);
    throw new DatabaseError('collects', 'Query failed', postgrestCodeOf(countError));
  }

  return toArtistData(collection, count || 0);
}

/**
 * Top products for an artist by handle (simplified for homepage use).
 * Returns the newest products without pagination. Unknown artist or no
 * linked products → `[]`; query failure → throws.
 */
export async function getTopProductsByArtistHandle(
  artistHandle: string,
  limit = 4,
  useStatic = false
): Promise<ProductWithDetails[]> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  // First get the collection ID for this artist
  const collection = await queryOrThrow<{ id: number }>(
    'artist:collection-homepage',
    'collections',
    () => supabase
      .from('collections')
      .select('id')
      .eq('handle', artistHandle)
      .maybeSingle(),
  );

  if (!collection) return [];

  // Get product IDs from collects
  const collectsData = await queryOrThrow<{ product_id: number }[]>(
    'artist:collects-homepage',
    'collects',
    () => supabase
      .from('collects')
      .select('product_id')
      .eq('collection_id', collection.id),
  );

  if (!collectsData || collectsData.length === 0) return [];

  const productIds = collectsData.map(c => c.product_id);

  const { data } = await fetchProductsByIds(supabase, productIds, { sort: 'newest', page: 1, pageSize: limit });
  return data;
}

export interface CollectionPageOptions {
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

/**
 * Products for a collection/artist handle via the collects two-hop, paged.
 * Unknown handle → `null` (page calls `notFound()`); linked-nothing → empty
 * page; query failure → throws. Server twin of the old client-side
 * CollectionProducts/ArtistProducts fetches — one implementation serves
 * SSR page 1 and `GET /api/products` pages 2+.
 */
export async function getProductsByCollectionHandle(
  handle: string,
  options: CollectionPageOptions = {},
  opts: { publishedOnly?: boolean; useStatic?: boolean } = {},
): Promise<{ data: ProductWithDetails[]; count: number } | null> {
  const { publishedOnly = true, useStatic = false } = opts;
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  let collectionQuery = supabase
    .from('collections')
    .select('id')
    .eq('handle', handle);
  if (publishedOnly) collectionQuery = collectionQuery.eq('published', true);
  const collection = await queryOrThrow<{ id: number }>(
    'collection:products-id',
    'collections',
    () => collectionQuery.maybeSingle(),
  );

  if (!collection) return null;

  const collectsData = await queryOrThrow<{ product_id: number }[]>(
    'collection:products-ids',
    'collects',
    () => supabase
      .from('collects')
      .select('product_id')
      .eq('collection_id', collection.id),
  );

  if (!collectsData || collectsData.length === 0) return { data: [], count: 0 };

  return fetchProductsByIds(supabase, collectsData.map((c) => c.product_id), {
    sort: options.sort ?? 'newest',
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 12,
  });
}

/**
 * Products with combined filters (artist, type, sort, pagination).
 * The load-bearing catalog read: failure throws `DatabaseError` so
 * `/products` renders the error boundary instead of "No products found".
 */
// Canonical sort vocabulary lives in `@/lib/product`; re-exported here so
// existing `@/lib/supabase/queries` import sites keep working.
export type { SortOption } from '@/lib/product';

export interface ProductFilterOptions {
  artist?: string;
  productType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortOption;
}

export async function getProductsFiltered(
  options: ProductFilterOptions = {}
): Promise<{ data: ProductWithDetails[]; count: number }> {
  const { artist, productType, page = 1, pageSize = 20, sortBy = 'newest' } = options;
  // Backend-less builds degrade the filter UI to empty instead of failing.
  if (isSupabaseUnconfigured()) return { data: [], count: 0 };
  const supabase = await createServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('status', 'active');

  // Apply artist filter (match vendor name case-insensitively, escaped)
  if (artist) {
    query = query.ilike('vendor', `%${escapeLike(artist)}%`);
  }

  // Apply product type filter
  if (productType) {
    query = query.ilike('product_type', `%${escapeLike(productType)}%`);
  }

  // Apply sorting. Price sorts order by the cached min_price in SQL (see
  // supabase/migrations/001_min_price.sql); rows that predate the backfill
  // (NULL min_price) are re-sorted client-side from variant prices below.
  const isPriceSort = sortBy === 'price-asc' || sortBy === 'price-desc';
  if (sortBy === 'title') {
    query = query.order('title', { ascending: true });
  } else if (isPriceSort) {
    query = query.order('min_price', { ascending: sortBy === 'price-asc', nullsFirst: false });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  const { data, error, count } = await query.range(
    ...(isPriceSort ? [0, PRICE_SORT_FETCH_LIMIT - 1] as const : [from, to] as const)
  );

  // List queries cannot produce PGRST116; any error here is a failed read.
  if (error) throwDbError('products:filtered', 'products', error);

  // `as unknown as`: the inferred select shape is precise per the `Database`
  // type but structurally wider than the hand-maintained `ProductWithDetails`.
  let products = (data || []) as unknown as ProductWithDetails[];

  // SQL min_price ordering is authoritative only when every fetched row is
  // backfilled. Otherwise the NULL-min_price rows (sorted to the tail by
  // NULLS LAST) land in the wrong position, so re-sort client-side from
  // variant prices. Correct while the filtered catalog stays under
  // PRICE_SORT_FETCH_LIMIT; beyond it the sorted pages and `count` disagree.
  if (isPriceSort && !products.every((p) => Number.isFinite(Number((p as { min_price?: unknown }).min_price)))) {
    products = sortProductsByPrice(products, sortBy === 'price-asc' ? 'asc' : 'desc');
  }
  if (isPriceSort) {
    products = products.slice(from, to + 1);
  }

  return {
    data: products,
    count: count || 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/** Published articles with pagination. */
export async function getArticles(
  page = 1,
  pageSize = 12
): Promise<{ data: ArticleWithBlog[]; count: number }> {
  // Backend-less builds degrade the blog index to empty instead of failing.
  if (isSupabaseUnconfigured()) return { data: [], count: 0 };
  const supabase = await createServerClient();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('articles')
    .select(`
      *,
      blog:blogs(id, title, handle)
    `, { count: 'exact' })
    .eq('published', true)
    .not('handle', 'is', null)
    .order('published_at', { ascending: false })
    .range(from, to);

  // List queries cannot produce PGRST116; any error here is a failed read.
  if (error) throwDbError('articles:list', 'articles', error);

  return {
    data: (data || []) as ArticleWithBlog[],
    count: count || 0
  };
}

/** Single published article by slug. Missing → `null`; failure → throws. */
export async function getArticleBySlug(slug: string): Promise<ArticleWithBlog | null> {
  const supabase = await createServerClient();

  const data = await queryOrThrow<ArticleWithBlog>(
    'articles:by-slug',
    'articles',
    () => supabase
      .from('articles')
      .select(`
        *,
        blog:blogs(id, title, handle)
      `)
      .eq('handle', slug)
      .eq('published', true)
      .single(),
  );

  return data as ArticleWithBlog | null;
}

/** Single article by slug (static version for generateMetadata). */
export async function getArticleBySlugStatic(slug: string): Promise<ArticleWithBlog | null> {
  const supabase = createStaticClient();

  const data = await queryOrThrow<ArticleWithBlog>(
    'articles:by-slug-static',
    'articles',
    () => supabase
      .from('articles')
      .select(`
        *,
        blog:blogs(id, title, handle)
      `)
      .eq('handle', slug)
      .eq('published', true)
      .single(),
  );

  return data as ArticleWithBlog | null;
}

/** Related articles (excluding the current one). */
export async function getRelatedArticles(
  currentArticleId: number,
  limit = 3
): Promise<Article[]> {
  const supabase = await createServerClient();

  const data = await queryOrThrow<Article[]>(
    'articles:related',
    'articles',
    async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('published', true)
        .not('handle', 'is', null)
        .neq('id', currentArticleId)
        .order('published_at', { ascending: false })
        .limit(limit);
      return { data: data as Article[] | null, error };
    },
  );

  return (data || []) as Article[];
}

/**
 * All published articles for static generation. Build-time enumeration
 * degrades to `[]`; request-time reads throw instead.
 */
export async function getArticlesStatic(): Promise<Article[]> {
  try {
    const supabase = createStaticClient();

    const data = await queryOrThrow<Article[]>(
      'articles:list-static',
      'articles',
      async () => {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('published', true)
          .order('published_at', { ascending: false });
        return { data: data as Article[] | null, error };
      },
    );
    return (data || []) as Article[];
  } catch {
    return [];
  }
}

/**
 * Escape a value for a double-quoted PostgREST eq/neq filter. Unlike
 * `sanitizeOrPattern`, LIKE wildcards stay literal because eq does no matching.
 */
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
