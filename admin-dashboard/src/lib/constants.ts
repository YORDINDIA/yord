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

export const SMART_RULE_COLUMNS = [
  'title',
  'vendor',
  'product_type',
  'tags',
  'status',
] as const;

export const SMART_RULE_RELATIONS = ['equals', 'contains', 'not_equals'] as const;

export const DISCOUNT_VALUE_TYPES = ['percentage', 'fixed_amount'] as const;

// ─── Thresholds and limits ────────────────────────────────────────────────────

/**
 * A variant at or below this quantity is "low stock". Was hardcoded at
 * products/page.tsx and inventory/page.tsx with a matching `.lte(5)` filter;
 * both the badge and the query now read this one value.
 */
export const LOW_STOCK_THRESHOLD = 5;

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

/** Storage extension allowlist — anything else is stored as `.bin`. */
export const ALLOWED_MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

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
