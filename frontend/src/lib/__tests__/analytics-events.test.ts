import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_MAX_BATCH,
  analyticsBatchSchema,
  analyticsEventSchema,
} from '@/lib/analytics/eventsSchema';
import { eventsToRows } from '@/lib/analytics/rows';

const SID = '0b8f6c1e-3f4a-4c2d-9a7b-1e2d3f4a5b6c';

/**
 * The ingest contract shared by the collector and the API route: one schema
 * is the single source of truth, so anything the route would reject must fail
 * here first. The row mapping is pinned separately because the rollup RPCs
 * read snake_case `props` (`props ->> 'product_id'`) — a renamed key would
 * silently zero every ranking in the admin.
 */
function base(overrides: Record<string, unknown> = {}) {
  return { sid: SID, path: '/product/tee', ...overrides };
}

describe('analyticsEventSchema', () => {
  it('accepts every event in the vocabulary with valid fields', () => {
    const events = [
      { type: 'page_viewed', ...base(), template: 'product', handle: 'tee' },
      { type: 'product_viewed', ...base(), productId: 12, handle: 'tee' },
      { type: 'search_performed', ...base(), term: 'coldplay', results: 4 },
      {
        type: 'add_to_cart',
        ...base(),
        productId: 12,
        variantId: 34,
        quantity: 2,
        cartValue: 3998,
        cartItems: 3,
      },
      {
        type: 'remove_from_cart',
        ...base(),
        productId: 12,
        variantId: 34,
        quantity: 1,
        cartValue: 1999,
        cartItems: 1,
      },
      { type: 'cart_viewed', ...base(), cartValue: 1999, cartItems: 1 },
      { type: 'wishlist_added', ...base(), productId: 12, handle: 'tee' },
      { type: 'wishlist_removed', ...base(), productId: 12 },
      { type: 'checkout_started', ...base(), cartValue: 3998, cartItems: 2 },
      { type: 'checkout_failed', ...base(), step: 'verify' },
      { type: 'checkout_failed', ...base(), step: 'dismissed', code: 'Payment cancelled' },
      { type: 'order_completed', ...base(), orderId: 'pay_123', value: 3998, items: 2 },
    ];
    for (const event of events) {
      expect(analyticsEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('rejects unknown types and malformed fields', () => {
    const bad = [
      { type: 'screenshot_taken', ...base() },
      { type: 'product_viewed', ...base(), productId: 0 },
      { type: 'product_viewed', ...base(), productId: 1.5 },
      { type: 'search_performed', ...base(), term: '', results: 0 },
      { type: 'search_performed', ...base(), term: 'x'.repeat(129), results: 0 },
      { type: 'page_viewed', ...base(), template: 'portal' },
      { type: 'checkout_failed', ...base(), step: 'payment' },
      { type: 'order_completed', ...base(), orderId: 'pay_1', value: -5, items: 1 },
      // Missing session fields
      { type: 'product_viewed', productId: 12 },
      { type: 'product_viewed', ...base({ sid: 'not-a-uuid' }), productId: 12 },
      { type: 'product_viewed', ...base({ path: '' }), productId: 12 },
    ];
    for (const event of bad) {
      expect(analyticsEventSchema.safeParse(event).success).toBe(false);
    }
  });

  it('bounds the batch', () => {
    const event = { type: 'cart_viewed', ...base(), cartValue: 0, cartItems: 0 };
    expect(analyticsBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({
        events: Array.from({ length: ANALYTICS_MAX_BATCH + 1 }, () => event),
      }).success,
    ).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({
        events: Array.from({ length: ANALYTICS_MAX_BATCH }, () => event),
      }).success,
    ).toBe(true);
  });
});

describe('eventsToRows', () => {
  it('maps camelCase event fields to the snake_case props the RPCs read', () => {
    const [row] = eventsToRows([
      {
        type: 'add_to_cart',
        sid: SID,
        path: '/product/tee',
        productId: 12,
        variantId: 34,
        quantity: 2,
        cartValue: 3998,
        cartItems: 3,
      },
    ]);
    expect(row).toMatchObject({
      type: 'add_to_cart',
      sid: SID,
      path: '/product/tee',
      referrer: null,
      props: {
        product_id: 12,
        variant_id: 34,
        quantity: 2,
        cart_value: 3998,
        cart_items: 3,
      },
    });
  });

  it('keeps page templates and optional handles, dropping absent ones', () => {
    const [withHandle, without] = eventsToRows([
      { type: 'page_viewed', sid: SID, path: '/product/tee', template: 'product', handle: 'tee' },
      { type: 'page_viewed', sid: SID, path: '/', template: 'home' },
    ]);
    expect(withHandle.props).toEqual({ template: 'product', handle: 'tee' });
    expect(without.props).toEqual({ template: 'home' });
  });

  it('passes the session referrer through when present', () => {
    const [row] = eventsToRows([
      {
        type: 'product_viewed',
        sid: SID,
        path: '/product/tee',
        referrer: 'https://google.com',
        productId: 12,
      },
    ]);
    expect(row.referrer).toBe('https://google.com');
    expect(row.props).toEqual({ product_id: 12 });
  });

  it('maps search terms with their zero-result flag source', () => {
    const [row] = eventsToRows([
      { type: 'search_performed', sid: SID, path: '/search', term: 'vinyl', results: 0 },
    ]);
    expect(row.props).toEqual({ term: 'vinyl', results: 0 });
  });
});
