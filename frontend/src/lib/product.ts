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
 * to `published_at DESC`, i.e. `newest` (verified 2026-10-01).
 *
 * `manual` is the admin-writable "picker order" (`collections.sort_order`), a
 * curated order over `collects.position` that `sql/005_positional_collection_products.sql`
 * persists on write. It never appears in the shopper sort dropdown, and it is
 * not expressible as a products-table `ORDER BY`: the id-list fetch resolves it
 * by the caller's id order (see `fetchProductsByIds`).
 */
export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'title' | 'manual';

const SORT_VALUES: readonly string[] = [
  'newest',
  'price-asc',
  'price-desc',
  'title',
  'manual',
];

/** Validate a raw `?sort=` param; unknown values fall back to `newest`. */
export function parseSortParam(value: unknown): SortOption {
  return typeof value === 'string' && SORT_VALUES.includes(value)
    ? (value as SortOption)
    : 'newest';
}

/** Validate a raw `?page=` param; clamps to 1..100. */
export function parsePageParam(value: unknown): number {
  const page = typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(page) && page > 0 ? Math.min(page, 100) : 1;
}

/**
 * Effective catalog order for a collection page.
 *
 * The shopper's `?sort=` always wins; with no `?sort=` the collection's own
 * `collections.sort_order` is the default. NULL (every collection created
 * before the field existed) or an unknown value resolves to `newest`.
 *
 * Both halves must be resolved through this one function: the page needs the
 * resolved value to seed `CatalogGrid`, and `GET /api/products` needs the same
 * value when the shopper passes no sort — a divergence would make page 1 and
 * page 2 of the same URL show different orders.
 */
export function resolveSort(
  requested: unknown,
  collectionDefault?: string | null,
): SortOption {
  return parseSortParam(requested ?? collectionDefault ?? undefined);
}

/** Primary image URL (prefer the stored `storage_url`, fall back to the original `src`). */
export function getImageUrl(image: ProductImage | null | undefined): string {
  if (!image) return '/placeholder-product.png';
  return image.storage_url || image.src;
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
  // Absent prices are not prices: Number(null) is 0, which would fake a sale
  // against any compare-at value. (Caught by product-helpers.test.ts.)
  if (price == null || price === '' || compareAtPrice == null || compareAtPrice === '') {
    return false;
  }
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
    handle: product.handle ?? '',
    title: product.title,
    artist,
    price: variant?.price || 0,
    compareAtPrice: variant?.compare_at_price || null,
    image: image?.storage_url || image?.src || null,
    badge: getProductBadge(product, variant),
    accentColor: overrides?.accentColor || artistAccentColor(product.vendor),
  };
}

/**
 * Artist accent color from vendor name; default to the theme accent.
 *
 * The fallback is `var(--accent)` rather than a gold literal: this value is
 * painted as text on the artist badge, and the gold ramp only reaches ~3.9:1
 * on the light page, which fails AA. `var(--accent)` is 5.48:1 on light and
 * 14.49:1 on dark. A per-artist accentColor from static data still wins, and
 * those are brand identity colors used over artwork.
 */
export function artistAccentColor(vendor: string | null): string {
  if (!vendor) return 'var(--accent)';
  const handle = vendor.toLowerCase().replace(/\s+/g, '-');
  const artistData = ARTISTS[handle];
  return artistData?.accentColor || 'var(--accent)';
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

/** One PostgREST `.order()` clause (supabase-js `.order()` options shape). */
export interface CatalogOrderClause {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

/**
 * The one catalog order, shared by every paged list (auto collections and the
 * collects/ids path) so two pages of the same sort cannot disagree.
 *
 * The final clause is a tie-break on `id`, and it is load-bearing rather than
 * defensive: OFFSET paging over a non-total order lets Postgres return tied
 * rows in any order, so consecutive page requests can repeat or skip products.
 * Ties are the norm here, not an edge case — of the 463 active products, 145
 * share the ₹900 `min_price`, 140 share ₹1,100, and 122 share a `title` with
 * another row (measured 2025-10-02). `title` and `price-*` were both
 * effectively paginated in arbitrary order.
 *
 * `nullsFirst: false` on `published_at` is deliberate: Postgres puts NULLs
 * FIRST on a DESC sort, so an undated product would lead "Newest" — the tidy
 * script's backfill is what keeps that from being every row.
 */
export function catalogOrder(sort: SortOption): CatalogOrderClause[] {
  const tieBreak: CatalogOrderClause = { column: 'id', ascending: false };
  if (sort === 'manual') {
    // Not expressible over the products table — the id-list fetch resolves it
    // by the caller's id order before SQL runs. Degrade to newest if a stray
    // caller reaches here, rather than crashing on an unmapped sort.
    return [{ column: 'published_at', ascending: false, nullsFirst: false }, tieBreak];
  }
  if (sort === 'title') {
    return [{ column: 'title', ascending: true }, tieBreak];
  }
  if (sort === 'price-asc' || sort === 'price-desc') {
    return [
      { column: 'min_price', ascending: sort === 'price-asc', nullsFirst: false },
      tieBreak,
    ];
  }
  return [
    { column: 'published_at', ascending: false, nullsFirst: false },
    tieBreak,
  ];
}

/** DECIMAL/absent-tolerant number for a nullable column read as `unknown`. */
function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * `catalogOrder` applied in JS, for paths that merge or re-sort rows after
 * fetching (the chunked id-list fetch sorts merged chunks itself).
 *
 * Same key order, same null placement (nulls always last) and the same
 * `id desc` tie-break as the SQL clause list, so a JS-sorted page and a
 * SQL-sorted page of the same list cannot disagree. For price sorts the caller
 * must only use this when every row carries a usable `min_price`; otherwise
 * the variant-price fallback (`sortProductsByPrice`) is authoritative.
 */
export function compareCatalogProducts(
  a: ProductWithDetails,
  b: ProductWithDetails,
  sort: SortOption
): number {
  // Highest id first: ids are increasing over time (Shopify ids, then
  // `admin_next_id`), so the tie-break reads as newest-created first.
  const tieBreak = b.id - a.id;
  if (sort === 'manual') {
    // The caller preserves its given id order (`collects.position`); a
    // comparator that reordered rows would corrupt it. 0 keeps `Array.sort`
    // stable, though `fetchProductsByIds` re-orders explicitly anyway.
    return 0;
  }
  if (sort === 'title') {
    return a.title.localeCompare(b.title) || tieBreak;
  }
  if (sort === 'price-asc' || sort === 'price-desc') {
    const pa = nullableNumber((a as { min_price?: unknown }).min_price);
    const pb = nullableNumber((b as { min_price?: unknown }).min_price);
    if (pa === null && pb === null) return tieBreak;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return (sort === 'price-asc' ? pa - pb : pb - pa) || tieBreak;
  }
  const ta = a.published_at ? Date.parse(a.published_at) : NaN;
  const tb = b.published_at ? Date.parse(b.published_at) : NaN;
  const na = Number.isNaN(ta) ? null : ta;
  const nb = Number.isNaN(tb) ? null : tb;
  if (na === null && nb === null) return tieBreak;
  if (na === null) return 1;
  if (nb === null) return -1;
  return (nb - na) || tieBreak;
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
