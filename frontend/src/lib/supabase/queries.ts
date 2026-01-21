import { createServerClient, createStaticClient } from './server';
import type { ProductWithDetails, Collection, ArtistData, Blog, Article, ArticleWithBlog } from '@/types/database';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@/types/database';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get featured products for homepage
 */
export async function getFeaturedProducts(limit = 8): Promise<ProductWithDetails[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position, width, height
      )
    `)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured products:', error);
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
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `, { count: 'exact' })
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching products:', error);
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
    .select(`
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
    `)
    .eq('handle', handle)
    .eq('status', 'active')
    .single();

  if (error) {
    console.error('Error fetching product:', error);
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
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `)
    .eq('status', 'active')
    .or(`title.ilike.%${query}%,vendor.ilike.%${query}%,tags.ilike.%${query}%`)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching products:', error);
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

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `)
    .eq('status', 'active')
    .neq('id', product.id)
    .or(`vendor.eq.${product.vendor},product_type.eq.${product.product_type}`)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related products:', error);
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
    console.error('Error fetching collections:', error);
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
    .single();

  if (error) {
    console.error('Error fetching collection:', error);
    return null;
  }

  return data as Collection;
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
    console.error('Error fetching collections (static):', error);
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
    .single();

  if (error) {
    console.error('Error fetching collection (static):', error);
    return null;
  }

  return data as Collection;
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

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Get product IDs in this collection through the collects junction table
  const { data: collectsData, error: collectsError } = await supabase
    .from('collects')
    .select('product_id')
    .eq('collection_id', collection.id);

  if (collectsError || !collectsData || collectsData.length === 0) {
    return { data: [], count: 0, collection };
  }

  const productIds = (collectsData as { product_id: number }[]).map(c => c.product_id);

  // Build the query with sorting
  let query = supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `, { count: 'exact' })
    .in('id', productIds)
    .eq('status', 'active');

  // Apply sorting
  switch (sortBy) {
    case 'price-asc':
      query = query.order('id', { ascending: true }); // Will sort client-side for variant price
      break;
    case 'price-desc':
      query = query.order('id', { ascending: false }); // Will sort client-side for variant price
      break;
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('published_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('Error fetching collection products:', error);
    return { data: [], count: 0, collection };
  }

  let products = (data || []) as ProductWithDetails[];

  // Client-side price sorting since we need to look at variant prices
  if (sortBy === 'price-asc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceA - priceB;
    });
  } else if (sortBy === 'price-desc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceB - priceA;
    });
  }

  return {
    data: products,
    count: count || 0,
    collection
  };
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
    console.error('Error fetching product types:', error);
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
    console.error('Error fetching artist collections:', collectionsError);
    return [];
  }

  // Get product counts for each artist collection via collects
  const artistsWithCounts = await Promise.all(
    (collections as { id: number; title: string; handle: string | null; body_html: string | null; image_src: string | null }[]).map(async (col) => {
      const { count } = await supabase
        .from('collects')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', col.id);

      // Get static metadata for colors, images, etc.
      const handle = col.handle || '';
      const staticData = ARTISTS[handle];

      return {
        handle,
        vendorName: col.title, // Use collection title as display name
        name: staticData?.name || col.title,
        tagline: staticData?.tagline || 'Official Merchandise',
        bio: col.body_html?.replace(/<[^>]*>/g, '') || staticData?.bio || `Shop exclusive ${col.title} merchandise.`,
        heroImage: col.image_src || staticData?.heroImage || '/artists/default-hero.jpg',
        logoImage: staticData?.logoImage,
        accentColor: staticData?.accentColor || '#FFD700',
        secondaryColor: staticData?.secondaryColor || '#1C1C1C',
        productCount: count || 0,
      } as ArtistData;
    })
  );

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
    console.error('Error fetching artist collection:', error);
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
    heroImage: collection.image_src || staticData?.heroImage || '/artists/default-hero.jpg',
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
  limit = 4
): Promise<ProductWithDetails[]> {
  const supabase = await createServerClient();

  // First get the collection ID for this artist
  const { data: collectionData, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('handle', artistHandle)
    .single();

  const collection = collectionData as { id: number } | null;

  if (collectionError || !collection) {
    console.error('Error fetching artist collection for homepage:', collectionError);
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

  // Get products with details
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `)
    .in('id', productIds)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching top artist products:', error);
    return [];
  }

  return (data || []) as ProductWithDetails[];
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
    console.error('Error fetching artist collection:', collectionError);
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

  // Build query for products
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `, { count: 'exact' })
    .in('id', productIds)
    .eq('status', 'active');

  // Apply sorting
  switch (sortBy) {
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    case 'price-asc':
    case 'price-desc':
      query = query.order('published_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('published_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('Error fetching artist products:', error);
    return { data: [], count: 0 };
  }

  let products = (data || []) as ProductWithDetails[];

  // Client-side price sorting
  if (sortBy === 'price-asc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceA - priceB;
    });
  } else if (sortBy === 'price-desc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceB - priceA;
    });
  }

  return {
    data: products,
    count: count || 0
  };
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
    .select(`
      *,
      product_variants (
        id, title, price, compare_at_price,
        inventory_quantity, option1, option2, option3, position
      ),
      product_images (
        id, src, supabase_url, alt, position
      )
    `, { count: 'exact' })
    .eq('status', 'active');

  // Apply artist filter (match vendor name case-insensitively)
  if (artist) {
    query = query.ilike('vendor', artist);
  }

  // Apply product type filter
  if (productType) {
    query = query.ilike('product_type', productType);
  }

  // Apply sorting
  switch (sortBy) {
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    case 'price-asc':
    case 'price-desc':
      // Sort by published_at first, then client-side for price
      query = query.order('published_at', { ascending: false });
      break;
    default:
      query = query.order('published_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('Error fetching filtered products:', error);
    return { data: [], count: 0 };
  }

  let products = (data || []) as ProductWithDetails[];

  // Client-side price sorting (since price is in variants)
  if (sortBy === 'price-asc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceA - priceB;
    });
  } else if (sortBy === 'price-desc') {
    products = products.sort((a, b) => {
      const priceA = a.product_variants?.[0]?.price || 0;
      const priceB = b.product_variants?.[0]?.price || 0;
      return priceB - priceA;
    });
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
    console.error('Error fetching blogs:', error);
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
    console.error('Error fetching blog:', error);
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
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('articles')
    .select(`
      *,
      blog:blogs(id, title, handle)
    `, { count: 'exact' })
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching articles:', error);
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
    console.error('Error fetching article:', error);
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
    console.error('Error fetching blog articles:', error);
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
    console.error('Error fetching featured articles:', error);
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
    .neq('id', currentArticleId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related articles:', error);
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
    console.error('Error fetching articles (static):', error);
    return [];
  }

  return (data || []) as Article[];
}
