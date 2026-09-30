import type {
  ProductVariant,
  ProductImage,
  ProductWithDetails,
  BadgeType,
  TransformedProduct,
} from '@yord/db-types';
import { ARTISTS } from '@yord/db-types';

/**
 * Product-domain helpers: images, variants, pricing, badges, card transforms.
 * Pure functions safe for server and client components. Formatting (`cn`,
 * `formatPrice`) lives in `@yord/ui` — import from there directly.
 */

/**
 * The single catalog sort vocabulary. There is no `featured` value and no
 * ranking column behind it — every historical `featured` branch fell through
 * to `published_at DESC`, i.e. `newest` (verified 2026-10-01). Callers that
 * need a curated order pass explicit id lists instead.
 */
export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'title';

/** Primary image URL (prefer Supabase URL, fallback to Shopify CDN). */
export function getImageUrl(image: ProductImage | null | undefined): string {
  if (!image) return '/placeholder-product.jpg';
  return image.supabase_url || image.src;
}

/** Primary product image (lowest position). */
export function getPrimaryImage(images: ProductImage[] | undefined): ProductImage | null {
  if (!images || images.length === 0) return null;

  // Sort by position and get first
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return sorted[0];
}

/** Secondary image for hover effect. */
export function getSecondaryImage(images: ProductImage[] | undefined): ProductImage | null {
  if (!images || images.length < 2) return null;

  const sorted = [...images].sort((a, b) => a.position - b.position);
  return sorted[1];
}

/** Lowest price variant. Number() because PostgREST returns DECIMAL columns as strings at runtime. */
export function getLowestPriceVariant(variants: ProductVariant[] | undefined): ProductVariant | null {
  if (!variants || variants.length === 0) return null;

  return variants.reduce((min, v) =>
    Number(v.price) < Number(min.price) ? v : min
  , variants[0]);
}

/**
 * Check if product is on sale.
 * Uses Number() because PostgREST returns DECIMAL columns as strings at runtime,
 * where '<' would compare lexicographically ('1000' < '999' === true).
 */
export function isOnSale(variant: ProductVariant | null): boolean {
  if (!variant) return false;
  return isPriceOnSale(variant.price, variant.compare_at_price);
}

/** Compare prices safely regardless of DECIMAL-as-string runtime values. */
export function isPriceOnSale(
  price: number | string | null | undefined,
  compareAtPrice: number | string | null | undefined
): boolean {
  const p = Number(price);
  const c = Number(compareAtPrice);
  return Number.isFinite(p) && Number.isFinite(c) && c > p;
}

/** Discount percentage. */
export function getDiscountPercentage(variant: ProductVariant | null): number {
  if (!variant || !variant.compare_at_price) return 0;

  const price = Number(variant.price);
  const compareAt = Number(variant.compare_at_price);
  if (!Number.isFinite(price) || !Number.isFinite(compareAt) || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Check if product is in stock. */
export function isInStock(product: ProductWithDetails): boolean {
  if (!product.product_variants || product.product_variants.length === 0) return false;

  return product.product_variants.some(v => v.inventory_quantity > 0);
}

/** Determine the badge type for a product based on various factors. */
export function getProductBadge(
  product: ProductWithDetails,
  variant?: ProductVariant | null
): BadgeType | null {
  const activeVariant = variant || getLowestPriceVariant(product.product_variants);

  // Check if on sale (highest priority)
  if (isPriceOnSale(activeVariant?.price, activeVariant?.compare_at_price)) {
    return 'SALE';
  }

  // Check if low stock
  if (activeVariant?.inventory_quantity && activeVariant.inventory_quantity <= 5) {
    return 'LIMITED';
  }

  // Check if new (published within last 30 days)
  if (product.published_at) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (new Date(product.published_at).getTime() > thirtyDaysAgo) {
      return 'NEW';
    }
  }

  // Check tags for special badges
  const tags = product.tags?.toLowerCase() || '';
  if (tags.includes('limited')) return 'LIMITED';
  if (tags.includes('bestseller')) return 'BESTSELLER';
  if (tags.includes('trending')) return 'TRENDING';

  return null;
}

/** Transform a ProductWithDetails into a TransformedProduct for UI display. */
export function transformProductForCard(
  product: ProductWithDetails,
  overrides?: {
    artist?: string;
    accentColor?: string;
  }
): TransformedProduct {
  const variant = getFirstByPosition(product.product_variants);
  const image = getFirstByPosition(product.product_images);
  const artist = overrides?.artist || product.vendor || '';

  return {
    id: product.id.toString(),
    handle: product.handle,
    title: product.title,
    artist,
    price: variant?.price || 0,
    compareAtPrice: variant?.compare_at_price || null,
    image: image?.supabase_url || image?.src || null,
    badge: getProductBadge(product, variant),
    accentColor: overrides?.accentColor || artistAccentColor(product.vendor),
  };
}

/** Artist accent color from vendor name; default gold. */
export function artistAccentColor(vendor: string | null): string {
  if (!vendor) return '#FFD700';
  const handle = vendor.toLowerCase().replace(/\s+/g, '-');
  const artistData = ARTISTS[handle];
  return artistData?.accentColor || '#FFD700';
}

/**
 * Sort products by price (client-side, for when price is on variants).
 * NOTE: only correct when applied to the FULL matching set before pagination.
 * Sorting a single DB page produces globally wrong order, so callers fetching
 * price sorts must fetch the full set (up to PRICE_SORT_FETCH_LIMIT) first,
 * then sort, then slice the page window. Used only as a fallback for rows
 * whose cached products.min_price is NULL (pre-backfill); prefer SQL ordering
 * by min_price (see supabase/migrations/001_min_price.sql).
 */
export const PRICE_SORT_FETCH_LIMIT = 500;

/** Lowest variant price, tolerant of DECIMAL-as-string at runtime. */
export function getMinVariantPrice(product: ProductWithDetails): number {
  if (!product.product_variants || product.product_variants.length === 0) return 0;
  return product.product_variants.reduce((min, v) => {
    const price = Number(v.price);
    return Number.isFinite(price) && price < min ? price : min;
  }, Number(product.product_variants[0].price) || 0);
}

export function sortProductsByPrice(
  products: ProductWithDetails[],
  direction: 'asc' | 'desc'
): ProductWithDetails[] {
  return [...products].sort((a, b) => {
    const priceA = getMinVariantPrice(a);
    const priceB = getMinVariantPrice(b);
    return direction === 'asc' ? priceA - priceB : priceB - priceA;
  });
}

/** Sort items by position (ascending). Common for variants and images. */
export function sortByPosition<T extends { position: number }>(items: T[] | undefined): T[] {
  if (!items || items.length === 0) return [];
  return [...items].sort((a, b) => a.position - b.position);
}

/** Get first item sorted by position. */
export function getFirstByPosition<T extends { position: number }>(items: T[] | undefined): T | null {
  const sorted = sortByPosition(items);
  return sorted[0] ?? null;
}
