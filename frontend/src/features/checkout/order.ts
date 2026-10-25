import type { AddressData } from './types';

/**
 * Order identity and the confirmation payload.
 *
 * `order_name` is minted in `verify-payment` as
 * `YORD-<epochSeconds>-<2 random bytes, uppercase hex>`. Two surfaces validate
 * that shape (this app's confirmation page and `/track-order`) and one mints
 * it, so the pattern lives here once instead of as a regex copy per surface —
 * a second contract that drifts silently is exactly how a paid order stops
 * being recognisable.
 *
 * The suffix stays `+` rather than `{4}` on purpose: the current mint always
 * produces four hex characters, but an order name minted by an earlier build
 * is still a real order.
 *
 * The epoch is a capture group because `orderNameEpochSeconds` reads it back
 * out; without it the delivery estimate would silently fall back to "now".
 */
export const YORD_ORDER_NAME_RE = /^YORD-(\d+)-[0-9A-F]+$/;

export function isYordOrderName(value: unknown): value is string {
  return typeof value === 'string' && YORD_ORDER_NAME_RE.test(value);
}

/**
 * Epoch seconds embedded in the order name, or `null` when the name does not
 * carry a plausible timestamp. The delivery estimate has to be anchored to the
 * order rather than to the page view — the shopper may open the confirmation
 * link a week later.
 */
export function orderNameEpochSeconds(orderName: string): number | null {
  const match = YORD_ORDER_NAME_RE.exec(orderName);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  // A future timestamp (clock skew, hand-edited URL) would push the estimate
  // into a range no order can have; fall back to the caller's default.
  if (seconds * 1000 > Date.now() + 24 * 60 * 60 * 1000) return null;
  return seconds;
}

export interface StoredOrderItem {
  title: string;
  variantTitle: string | null;
  price: number;
  quantity: number;
  image: string | null;
}

/**
 * What the confirmation screen renders. Written once, at the moment the
 * payment is verified, and read only by the success screen in the same tab —
 * it is a display payload, never a source of truth for money.
 */
export interface StoredOrder {
  orderName: string;
  paymentId: string;
  razorpayOrderId: string;
  shippingAddress: AddressData;
  billingAddress: AddressData;
  items: StoredOrderItem[];
  subtotal: number;
  /**
   * Rupees the promo code took off, and the code itself. Both optional: a
   * payload written before this existed has neither, and the confirmation
   * screen renders the discount line only when it is non-zero.
   */
  discount?: number;
  promoCode?: string | null;
  gst: number;
  total: number;
  /** Epoch ms, when the payload was written. Diagnostic only. */
  at: number;
}

export const LAST_ORDER_STORAGE_KEY = 'yord_last_order';

export function saveLastOrder(order: Omit<StoredOrder, 'at'>): void {
  try {
    sessionStorage.setItem(
      LAST_ORDER_STORAGE_KEY,
      JSON.stringify({ ...order, at: Date.now() })
    );
  } catch {
    // Private mode or storage disabled. The confirmation screen falls back to
    // the order number and ETA from the URL — a paid order must never fail
    // because a browser refused a write.
  }
}

/**
 * The last order written by this tab, for `useSyncExternalStore`. Callers
 * still match `orderName` against the one in the URL: a payload from an
 * earlier checkout in the same tab must never render under a different order
 * number.
 *
 * `sessionStorage` is not reactive, so there is nothing to subscribe to: the
 * snapshot is cached by its raw string because React compares snapshots with
 * `Object.is`, and a fresh `JSON.parse` on every call would re-render forever.
 */
let cachedRaw: string | null | undefined;
let cachedOrder: StoredOrder | null = null;

export function subscribeToLastOrder(): () => void {
  return () => {};
}

export function getLastOrderSnapshot(): StoredOrder | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedOrder;
  cachedRaw = raw;
  cachedOrder = raw ? parseStoredOrder(raw) : null;
  return cachedOrder;
}

function parseStoredOrder(raw: string): StoredOrder | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredOrder>;
    if (typeof parsed?.orderName !== 'string') return null;
    if (!Array.isArray(parsed.items) || typeof parsed.total !== 'number') return null;
    return parsed as StoredOrder;
  } catch {
    return null;
  }
}

/** Delivery estimate: 3-7 business days from the order, per `/shipping`. */
export function estimatedDeliveryWindow(orderedAt: Date): { start: Date; end: Date } {
  return { start: addBusinessDays(orderedAt, 3), end: addBusinessDays(orderedAt, 7) };
}

function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date;
}
