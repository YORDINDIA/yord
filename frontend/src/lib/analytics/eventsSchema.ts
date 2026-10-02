import { z } from 'zod';

/**
 * The behavioral event vocabulary shared by the storefront collector
 * (`lib/analytics/track.ts`) and the ingest route (`api/analytics/events`).
 *
 * One zod schema is the single source of truth for both sides, so a client
 * change that the route would reject fails the schema tests here instead of
 * silently dropping events in production. Field names are camelCase in
 * transit; `lib/analytics/rows.ts` maps them to the snake_case `props` the
 * rollup RPCs read.
 *
 * No PII: events carry a random per-browser `sid`, the query-stripped path,
 * and product/search/cart fields — never an email, phone, or auth user id.
 */

/** Route buckets for `page_viewed` (see `routeTemplate.ts`). */
export const PAGE_TEMPLATES = [
  'home',
  'product',
  'collection',
  'artist',
  'catalog',
  'search',
  'blog',
  'cart',
  'checkout',
  'account',
  'other',
] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];

/** Every event identifies the browser and the (query-stripped) page. */
const baseFields = {
  sid: z.uuid(),
  path: z.string().min(1).max(512),
  referrer: z.string().max(256).optional(),
};

const positiveInt = z.number().int().positive();
const count = z.number().int().nonnegative();
const money = z.number().nonnegative().finite();

export const analyticsEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('page_viewed'),
    ...baseFields,
    template: z.enum(PAGE_TEMPLATES),
    handle: z.string().min(1).max(256).optional(),
  }),
  z.object({
    type: z.literal('product_viewed'),
    ...baseFields,
    productId: positiveInt,
    handle: z.string().min(1).max(256).optional(),
  }),
  z.object({
    type: z.literal('search_performed'),
    ...baseFields,
    term: z.string().min(1).max(128),
    results: count,
  }),
  z.object({
    type: z.literal('add_to_cart'),
    ...baseFields,
    productId: positiveInt,
    variantId: positiveInt,
    quantity: positiveInt,
    cartValue: money,
    cartItems: count,
  }),
  z.object({
    type: z.literal('remove_from_cart'),
    ...baseFields,
    productId: positiveInt,
    variantId: positiveInt,
    quantity: count,
    cartValue: money,
    cartItems: count,
  }),
  z.object({
    type: z.literal('cart_viewed'),
    ...baseFields,
    cartValue: money,
    cartItems: count,
  }),
  z.object({
    type: z.literal('wishlist_added'),
    ...baseFields,
    productId: positiveInt,
    handle: z.string().min(1).max(256).optional(),
  }),
  z.object({
    type: z.literal('wishlist_removed'),
    ...baseFields,
    productId: positiveInt,
    handle: z.string().min(1).max(256).optional(),
  }),
  z.object({
    type: z.literal('checkout_started'),
    ...baseFields,
    cartValue: money,
    cartItems: count,
  }),
  z.object({
    type: z.literal('checkout_failed'),
    ...baseFields,
    step: z.enum(['create_order', 'razorpay', 'verify', 'dismissed']),
    code: z.string().min(1).max(64).optional(),
  }),
  z.object({
    type: z.literal('order_completed'),
    ...baseFields,
    orderId: z.string().min(1).max(64),
    value: money,
    items: count,
  }),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

/**
 * What callers pass to `track()`: the discriminated event minus the session
 * fields the collector fills in. `Omit` alone would collapse the union and
 * lose per-type checking, hence the distributive form.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type TrackableEvent = DistributiveOmit<AnalyticsEvent, 'sid' | 'path' | 'referrer'>;

export const ANALYTICS_MAX_BATCH = 20;

export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(ANALYTICS_MAX_BATCH),
});

export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;
