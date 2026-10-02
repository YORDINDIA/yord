import type { AnalyticsEvent, AnalyticsBatch } from './eventsSchema';

/**
 * Map validated client events to `analytics_events` rows.
 *
 * Transit is camelCase (the shared zod schema, convenient in React code);
 * storage is the snake_case `props` the rollup RPCs read with
 * `props ->> 'product_id'` etc. Keeping the mapping in one pure function
 * (not inline in the route) means the vitest suite can pin the exact shape
 * the SQL expects.
 */

export interface AnalyticsEventRow {
  type: AnalyticsEvent['type'];
  sid: string;
  path: string;
  referrer: string | null;
  props: Record<string, unknown>;
}

function propsFor(event: AnalyticsEvent): Record<string, unknown> {
  switch (event.type) {
    case 'page_viewed':
      return {
        template: event.template,
        ...(event.handle !== undefined ? { handle: event.handle } : {}),
      };
    case 'product_viewed':
      return {
        product_id: event.productId,
        ...(event.handle !== undefined ? { handle: event.handle } : {}),
      };
    case 'search_performed':
      return { term: event.term, results: event.results };
    case 'add_to_cart':
      return {
        product_id: event.productId,
        variant_id: event.variantId,
        quantity: event.quantity,
        cart_value: event.cartValue,
        cart_items: event.cartItems,
      };
    case 'remove_from_cart':
      return {
        product_id: event.productId,
        variant_id: event.variantId,
        quantity: event.quantity,
        cart_value: event.cartValue,
        cart_items: event.cartItems,
      };
    case 'cart_viewed':
      return { cart_value: event.cartValue, cart_items: event.cartItems };
    case 'wishlist_added':
    case 'wishlist_removed':
      return {
        product_id: event.productId,
        ...(event.handle !== undefined ? { handle: event.handle } : {}),
      };
    case 'checkout_started':
      return { cart_value: event.cartValue, cart_items: event.cartItems };
    case 'checkout_failed':
      return {
        step: event.step,
        ...(event.code !== undefined ? { code: event.code } : {}),
      };
    case 'order_completed':
      return { order_id: event.orderId, value: event.value, items: event.items };
  }
}

export function eventsToRows(events: AnalyticsBatch['events']): AnalyticsEventRow[] {
  return events.map((event) => ({
    type: event.type,
    sid: event.sid,
    path: event.path,
    referrer: event.referrer ?? null,
    props: propsFor(event),
  }));
}
