/**
 * Single home for constants that were previously copy-pasted across pages.
 *
 * Everything here is plain data with no server-only imports, so it can be used
 * from Server Components, Client Components, and the middleware bundle alike.
 */

// ─── Order / listing status vocabularies ──────────────────────────────────────

/** Shopify-style financial states an order can hold. */
export const FINANCIAL_STATUSES = [
  'pending',
  'paid',
  'refunded',
  'partially_refunded',
  'voided',
  'failed',
] as const;

/** Shopify-style fulfillment states an order can hold. */
export const FULFILLMENT_STATUSES = [
  'unfulfilled',
  'fulfilled',
  'partial',
  'restocked',
] as const;

/** Catalog lifecycle states. */
export const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const;

export const COLLECTION_TYPES = ['custom', 'smart'] as const;

/**
 * Collection handles whose membership the storefront computes at read time
 * (`new-arrivals` = newest active products, `all` = every active product).
 * Both apps agree on this list: the storefront answers them from `products`
 * instead of `collects`, so the edit form renders them read-only rather than
 * letting an admin curate a list that is never read.
 */
export const AUTO_COLLECTION_HANDLES = ['new-arrivals', 'all'] as const;

export function isAutoCollectionHandle(handle: string | null | undefined): boolean {
  return Boolean(handle) && (AUTO_COLLECTION_HANDLES as readonly string[]).includes(handle as string);
}

/** Sort options for the collections list (`?sort=`). */
export const COLLECTION_SORTS = ['updated_at', 'title', 'products'] as const;

/** Values the collections table's bulk action submits. */
export const BULK_COLLECTION_ACTIONS = ['published', 'unpublished'] as const;

/**
 * A collection's default product order (the `collections.sort_order` column).
 *
 * Mirrors the storefront's sort vocabulary (`frontend/src/lib/product.ts`) so
 * the collection page can use it as the default when the shopper has not
 * picked a sort. Empty = leave the storefront default (`newest`). `manual`
 * orders the collection by the picker's saved `collects.position` order
 * (`sql/005_positional_collection_products.sql` keeps that order on write).
 */
export const COLLECTION_SORT_ORDERS = [
  'newest',
  'price-asc',
  'price-desc',
  'title',
  'manual',
] as const;

/** Labels for the "Default product order" select. `newest` is the empty option. */
export const COLLECTION_SORT_ORDER_LABELS: Record<
  Exclude<(typeof COLLECTION_SORT_ORDERS)[number], 'newest'>,
  string
> = {
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  title: 'Title A–Z',
  // Orders by `collects.position`, i.e. the picker's ↑/↓ order (persisted by
  // sql/005_positional_collection_products.sql).
  manual: 'Manual — the picker’s saved order',
};

export const SMART_RULE_COLUMNS = [
  'title',
  'vendor',
  'product_type',
  'tags',
  'status',
] as const;

export const SMART_RULE_RELATIONS = ['equals', 'contains', 'not_equals'] as const;

export type SmartRuleColumn = (typeof SMART_RULE_COLUMNS)[number];
export type SmartRuleRelation = (typeof SMART_RULE_RELATIONS)[number];

export const DISCOUNT_VALUE_TYPES = ['percentage', 'fixed_amount'] as const;

// ─── Thresholds and limits ────────────────────────────────────────────────────

/**
 * A variant at or below this quantity is "low stock". Was hardcoded at
 * products/page.tsx and inventory/page.tsx with a matching `.lte(5)` filter;
 * both the badge and the query now read this one value.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** Badge tone for a stock quantity. */
export function stockTone(quantity: number): 'out' | 'low' | 'ok' {
  if (quantity <= 0) return 'out';
  return quantity <= LOW_STOCK_THRESHOLD ? 'low' : 'ok';
}

/** Narrow `value` to a member of a const list (status vocabularies, MIME allowlists). */
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/** Max bytes for a single admin media upload (client hint + server enforcement). */
export const MAX_MEDIA_BYTES = 10_000_000;

/** Max files accepted in one drop/paste batch. */
export const MAX_MEDIA_FILES = 10;

/** MIME types accepted by the media uploader, enforced on both sides. */
export const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** Default rows per page for every admin list table. */
export const PAGE_SIZE = 25;

/** Longest search term forwarded into a PostgREST `or()` filter. */
export const MAX_SEARCH_LENGTH = 100;

// ─── Routing ──────────────────────────────────────────────────────────────────

/**
 * Every top-level route segment guarded by the admin gate, in one place.
 * `middleware.ts` checks this list, and `routes.test.ts` asserts it matches the
 * actual `src/app/(admin)/*` tree plus the sidebar nav, so a new admin page
 * cannot be added without the gate noticing.
 */
export const ADMIN_ROUTE_PREFIXES = [
  'ai',
  'analytics',
  'articles',
  'blogs',
  'collections',
  'customers',
  'dashboard',
  'discounts',
  'inventory',
  'media',
  'orders',
  'products',
  'settings',
] as const;

/** Routes reachable without an admin session. */
export const PUBLIC_ROUTE_PREFIXES = ['login', 'access-denied'] as const;
