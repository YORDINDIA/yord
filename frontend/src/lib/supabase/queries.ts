import { createServerClient, createStaticClient } from './server';
import type { ProductWithDetails, Collection, ArtistData, Blog, Article, ArticleWithBlog } from '@/types/database';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@/types/database';
import { PRICE_SORT_FETCH_LIMIT, sortProductsByPrice, buildSearchOrFilter, escapeLike, escapeFilterValue } from '@/lib/utils';
import { fetchProductsByIds, PRODUCT_SELECT } from '@/lib/data/productsByIds';
import { logDbError } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get featured products for homepage
 * @param limit - max products
 * @param useStatic - use the static client so cacheable pages stay prerenderable
 */
export async function getFeaturedProducts(limit = 8, useStatic = false): Promise<ProductWithDetails[]> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logDbError('Error fetching featured products:', error);
    return [];
  }

  return (data || []) as ProductWithDetails[];
}

/**
 * Get all active products with pagination
 */
export async function getProducts(page = 1, pageSize = 20) {
  const supabase = await createServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .range(from, to);

  if (error) {
    logDbError('Error fetching products:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []) as ProductWithDetails[],
    count: count || 0
  };
}

/**
 * Get single product by handle (URL slug)
 */
export async function getProductByHandle(handle: string): Promise<ProductWithDetails | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('handle', handle)
    .eq('status', 'active')
    .single();

  if (error) {
    logDbError('Error fetching product:', error);
    return null;
  }

  return data as ProductWithDetails;
}

/**
 * Get single product by handle (static version for generateMetadata).
 * Uses the static client so prerendered pages don't opt into dynamic rendering.
 */
export async function getProductByHandleStatic(handle: string): Promise<ProductWithDetails | null> {
  const supabase = createStaticClient();

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('handle', handle)
    .eq('status', 'active')
    .single();

  if (error) {
    logDbError('Error fetching product (static):', error);
    return null;
  }

  return data as ProductWithDetails;
}

/**
 * Search products by title, vendor, or tags
 */
export async function searchProducts(
  query: string,
  limit = 20
): Promise<ProductWithDetails[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'active')
    .or(buildSearchOrFilter(query))
    .order('published_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    logDbError('Error searching products:', error);
    return [];
  }

  return (data || []) as ProductWithDetails[];
}

/**
 * Get related products (same vendor or product type)
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

  const { data, error } = await query
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logDbError('Error fetching related products:', error);
    return [];
  }

  return (data || []) as ProductWithDetails[];
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all published collections
 */
export async function getCollections(): Promise<Collection[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('published', true)
    .order('title', { ascending: true });

  if (error) {
    logDbError('Error fetching collections:', error);
    return [];
  }

  return (data || []) as Collection[];
}

/**
 * Get single collection by handle
 */
export async function getCollectionByHandle(handle: string): Promise<Collection | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('handle', handle)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    logDbError('Error fetching collection:', error);
    return null;
  }

  return data as Collection | null;
}

/**
 * Get all published collections (static version for generateStaticParams)
 * This version doesn't require cookies and can be called at build time
 */
export async function getCollectionsStatic(): Promise<Collection[]> {
  const supabase = createStaticClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('published', true)
    .order('title', { ascending: true });

  if (error) {
    logDbError('Error fetching collections (static):', error);
    return [];
  }

  return (data || []) as Collection[];
}

/**
 * Get single collection by handle (static version for generateMetadata)
 * This version doesn't require cookies and can be called at build time
 */
export async function getCollectionByHandleStatic(handle: string): Promise<Collection | null> {
  const supabase = createStaticClient();

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('handle', handle)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    logDbError('Error fetching collection (static):', error);
    return null;
  }

  return data as Collection | null;
}

/**
 * Get products in a collection by collection handle
 */
export async function getProductsByCollection(
  collectionHandle: string,
  page = 1,
  pageSize = 20,
  sortBy: 'newest' | 'price-asc' | 'price-desc' | 'title' = 'newest'
): Promise<{ data: ProductWithDetails[]; count: number; collection: Collection | null }> {
  const supabase = await createServerClient();

  // First get the collection
  const collection = await getCollectionByHandle(collectionHandle);
  if (!collection) {
    return { data: [], count: 0, collection: null };
  }

  // Get product IDs in this collection through the collects junction table
  const { data: collectsData, error: collectsError } = await supabase
    .from('collects')
    .select('product_id')
    .eq('collection_id', collection.id);

  if (collectsError || !collectsData || collectsData.length === 0) {
    return { data: [], count: 0, collection };
  }

  const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

  const { data, count } = await fetchProductsByIds(supabase, productIds, { sort: sortBy, page, pageSize });
  return { data, count, collection };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get unique product types/categories
 */
export async function getProductTypes(): Promise<string[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select('product_type')
    .eq('status', 'active')
    .not('product_type', 'is', null);

  if (error) {
    logDbError('Error fetching product types:', error);
    return [];
  }

  const types = [...new Set((data as { product_type: string | null }[] | null)?.map(p => p.product_type).filter(Boolean))] as string[];
  return types.sort();
}

/**
 * Get artists with metadata and product counts
 * Queries artist collections and their linked products via collects table
 * @param useStatic - Use static client for build-time generation (no cookies)
 */
export async function getArtistsWithMetadata(useStatic = false): Promise<ArtistData[]> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  // Get artist collections
  const { data: collections, error: collectionsError } = await supabase
    .from('collections')
    .select('id, title, handle, body_html, image_src')
    .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]);

  if (collectionsError || !collections) {
    logDbError('artists:collections', collectionsError);
    return [];
  }

  // Get product counts for all artist collections in ONE query (not N+1)
  const collectionIds = (collections as { id: number }[]).map((c) => c.id);
  const { data: allCollects } = await supabase
    .from('collects')
    .select('collection_id')
    .in('collection_id', collectionIds);
  const counts = new Map<number, number>();
  for (const row of (allCollects as { collection_id: number }[] | null) || []) {
    counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1);
  }

  // Get product counts for each artist collection via collects
  const artistsWithCounts = (collections as { id: number; title: string; handle: string | null; body_html: string | null; image_src: string | null }[]).map((col) => {
      // Get static metadata for colors, images, etc.
      const handle = col.handle || '';
      const staticData = ARTISTS[handle];

      return {
        handle,
        vendorName: col.title, // Use collection title as display name
        name: staticData?.name || col.title,
        tagline: staticData?.tagline || 'Official Merchandise',
        bio: col.body_html?.replace(/<[^>]*>/g, '') || staticData?.bio || `Shop exclusive ${col.title} merchandise.`,
        heroImage: col.image_src || staticData?.heroImage,
        logoImage: staticData?.logoImage,
        accentColor: staticData?.accentColor || '#FFD700',
        secondaryColor: staticData?.secondaryColor || '#1C1C1C',
        productCount: counts.get(col.id) || 0,
      } as ArtistData;
    });

  // Filter out artists with 0 products and sort by product count
  return artistsWithCounts
    .filter(a => a.productCount && a.productCount > 0)
    .sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
}

/**
 * Get single artist by handle
 * Uses collection data combined with static metadata
 * @param handle - The artist handle (e.g., 'coldplay')
 * @param useStatic - Use static client for build-time generation (no cookies)
 */
export async function getArtistByHandle(handle: string, useStatic = false): Promise<ArtistData | null> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  // Get the collection for this artist
  const { data: collectionData, error } = await supabase
    .from('collections')
    .select('id, title, handle, body_html, image_src')
    .eq('handle', handle)
    .single();

  const collection = collectionData as { id: number; title: string; handle: string | null; body_html: string | null; image_src: string | null } | null;

  if (error || !collection) {
    logDbError('Error fetching artist collection:', error);
    return null;
  }

  // Get product count
  const { count } = await supabase
    .from('collects')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collection.id);

  // Get static metadata
  const staticData = ARTISTS[handle];

  return {
    handle,
    vendorName: collection.title,
    name: staticData?.name || collection.title,
    tagline: staticData?.tagline || 'Official Merchandise',
    bio: collection.body_html?.replace(/<[^>]*>/g, '') || staticData?.bio || `Shop exclusive ${collection.title} merchandise.`,
    heroImage: collection.image_src || staticData?.heroImage,
    logoImage: staticData?.logoImage,
    accentColor: staticData?.accentColor || '#FFD700',
    secondaryColor: staticData?.secondaryColor || '#1C1C1C',
    productCount: count || 0,
  };
}

/**
 * Get top products for an artist by handle (simplified for homepage use)
 * Returns the newest products without pagination
 */
export async function getTopProductsByArtistHandle(
  artistHandle: string,
  limit = 4,
  useStatic = false
): Promise<ProductWithDetails[]> {
  const supabase = useStatic ? createStaticClient() : await createServerClient();

  // First get the collection ID for this artist
  const { data: collectionData, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('handle', artistHandle)
    .maybeSingle();

  const collection = collectionData as { id: number } | null;

  if (collectionError || !collection) {
    if (collectionError) logDbError('artist:collection-homepage', collectionError);
    return [];
  }

  // Get product IDs from collects
  const { data: collectsData, error: collectsError } = await supabase
    .from('collects')
    .select('product_id')
    .eq('collection_id', collection.id);

  if (collectsError || !collectsData || collectsData.length === 0) {
    return [];
  }

  const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

  const { data } = await fetchProductsByIds(supabase, productIds, { sort: 'newest', page: 1, pageSize: limit });
  return data;
}

/**
 * Get products for an artist by handle (via collections and collects)
 */
export async function getProductsByArtistHandle(
  artistHandle: string,
  page = 1,
  pageSize = 20,
  sortBy: 'newest' | 'price-asc' | 'price-desc' | 'title' = 'newest'
): Promise<{ data: ProductWithDetails[]; count: number }> {
  const supabase = await createServerClient();

  // First get the collection ID for this artist
  const { data: collectionData, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('handle', artistHandle)
    .single();

  const collection = collectionData as { id: number } | null;

  if (collectionError || !collection) {
    logDbError('artist:collection', collectionError);
    return { data: [], count: 0 };
  }

  // Get product IDs from collects
  const { data: collectsData, error: collectsError } = await supabase
    .from('collects')
    .select('product_id')
    .eq('collection_id', collection.id);

  if (collectsError || !collectsData || collectsData.length === 0) {
    return { data: [], count: 0 };
  }

  const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

  return fetchProductsByIds(supabase, productIds, { sort: sortBy, page, pageSize });
}

/**
 * Get products with combined filters (artist, type, sort, pagination)
 */
export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'title';

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

  // Apply sorting (price sorts fetch the full set below, then slice)
  const isPriceSort = sortBy === 'price-asc' || sortBy === 'price-desc';
  if (sortBy === 'title') {
    query = query.order('title', { ascending: true });
  } else {
    query = query.order('published_at', { ascending: false });
  }

  const { data, error, count } = await query.range(
    ...(isPriceSort ? [0, PRICE_SORT_FETCH_LIMIT - 1] as const : [from, to] as const)
  );

  if (error) {
    logDbError('Error fetching filtered products:', error);
    return { data: [], count: 0 };
  }

  let products = (data || []) as ProductWithDetails[];

  // Price sorts apply to the fetched window (the newest PRICE_SORT_FETCH_LIMIT
  // rows), then slice the requested page. Correct while the active catalog stays
  // under that cap; beyond it the sorted pages and `count` disagree.
  if (isPriceSort) {
    products = sortProductsByPrice(products, sortBy === 'price-asc' ? 'asc' : 'desc').slice(from, to + 1);
  }

  return {
    data: products,
    count: count || 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all blogs
 */
export async function getBlogs(): Promise<Blog[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .order('title', { ascending: true });

  if (error) {
    logDbError('Error fetching blogs:', error);
    return [];
  }

  return (data || []) as Blog[];
}

/**
 * Get single blog by handle
 */
export async function getBlogByHandle(handle: string): Promise<Blog | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('blogs')
    .select('*')
    .eq('handle', handle)
    .single();

  if (error) {
    logDbError('Error fetching blog:', error);
    return null;
  }

  return data as Blog;
}

/**
 * Get published articles with pagination
 */
export async function getArticles(
  page = 1,
  pageSize = 12
): Promise<{ data: ArticleWithBlog[]; count: number }> {
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

  if (error) {
    logDbError('Error fetching articles:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []) as ArticleWithBlog[],
    count: count || 0
  };
}

/**
 * Get single article by slug (handle)
 */
export async function getArticleBySlug(slug: string): Promise<ArticleWithBlog | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      blog:blogs(id, title, handle)
    `)
    .eq('handle', slug)
    .eq('published', true)
    .single();

  if (error) {
    logDbError('Error fetching article:', error);
    return null;
  }

  return data as ArticleWithBlog;
}

/**
 * Get single article by slug (static version for generateMetadata).
 */
export async function getArticleBySlugStatic(slug: string): Promise<ArticleWithBlog | null> {
  const supabase = createStaticClient();

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      blog:blogs(id, title, handle)
    `)
    .eq('handle', slug)
    .eq('published', true)
    .single();

  if (error) {
    logDbError('Error fetching article (static):', error);
    return null;
  }

  return data as ArticleWithBlog;
}

/**
 * Get articles by blog handle
 */
export async function getArticlesByBlogHandle(
  blogHandle: string,
  page = 1,
  pageSize = 12
): Promise<{ data: Article[]; count: number; blog: Blog | null }> {
  const supabase = await createServerClient();

  // First get the blog
  const blog = await getBlogByHandle(blogHandle);
  if (!blog) {
    return { data: [], count: 0, blog: null };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('blog_id', blog.id)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(from, to);

  if (error) {
    logDbError('Error fetching blog articles:', error);
    return { data: [], count: 0, blog };
  }

  return {
    data: (data || []) as Article[],
    count: count || 0,
    blog
  };
}

/**
 * Get featured/recent articles for homepage
 */
export async function getFeaturedArticles(limit = 3): Promise<Article[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logDbError('Error fetching featured articles:', error);
    return [];
  }

  return (data || []) as Article[];
}

/**
 * Get related articles (excluding current article)
 */
export async function getRelatedArticles(
  currentArticleId: number,
  limit = 3
): Promise<Article[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .not('handle', 'is', null)
    .neq('id', currentArticleId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    logDbError('Error fetching related articles:', error);
    return [];
  }

  return (data || []) as Article[];
}

/**
 * Get all published articles for static generation
 */
export async function getArticlesStatic(): Promise<Article[]> {
  const supabase = createStaticClient();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) {
    logDbError('Error fetching articles (static):', error);
    return [];
  }

  return (data || []) as Article[];
}
