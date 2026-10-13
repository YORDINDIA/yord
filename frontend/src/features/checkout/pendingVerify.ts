/**
 * Durable reconcile state for a captured payment whose verify call was lost.
 *
 * `verify-payment` is idempotent on the Razorpay payment id (the order row's
 * unique `confirmation_number`), so a body that never got an answer is stored
 * in sessionStorage and re-POSTed before a new Razorpay order is created.
 * Without that replay a payment captured while the tab was closing — or while
 * every reconcile attempt failed — has no order and no retry, and the customer
 * who follows the error copy's advice and pays again is charged twice.
 *
 * What a failed replay means is a money decision, so it is made here, once:
 *
 *   recovered — the server answered 200: the order exists (or was just
 *               created from this body). Resolve the checkout with it; no
 *               second charge.
 *   settled   — the server proved this payment can never produce an order
 *               (nothing captured, or already refunded/compensated). Drop the
 *               body and let the customer start a fresh checkout.
 *   blocked   — anything else (5xx, dropped connection, timeout, a rejection
 *               we cannot read). The stored body is kept and a new charge is
 *               NOT started: starting one is exactly the double charge this
 *               module exists to prevent.
 */

export const PENDING_VERIFY_KEY = 'yord:pending-verify';

/** The subset of the Web Storage API this module needs (sessionStorage). */
export interface PendingVerifyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The three Razorpay ids the verify call and the confirmation payload need. */
export interface VerifyIds {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * The shipping address the stored body would have shipped to — the same shape
 * verify-payment's `orderData.shippingAddress` carries.
 */
export interface SnapshotAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/**
 * What the stored body would have ordered: the cart lines (variantId plus
 * quantity — the body never carries titles or prices, those are recomputed
 * server-side) and the shipping address.
 */
export interface PendingOrderSnapshot {
  cartItems: { variantId: number; quantity: number }[];
  shippingAddress: SnapshotAddress;
}

export interface PendingVerify {
  ids: VerifyIds;
  /** The exact body to re-POST: same ids, so the server stays idempotent. */
  body: string;
  /** Epoch ms, diagnostic only. */
  at: number;
  /** The order the body describes, or null when it carries no usable one. */
  snapshot: PendingOrderSnapshot | null;
}

/**
 * sessionStorage when it exists and is usable, else null. Null is not an
 * error: SSR, private mode and sandboxed iframes all land here, and every
 * caller degrades to "no durable reconcile" rather than failing a checkout.
 */
export function pendingVerifyStorage(): PendingVerifyStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The Razorpay ids out of a stored body, or null when the body is not a
 * verify body. The body is this app's own serialization of the gateway's
 * handler payload; parsing it here keeps the shape in one place and lets a
 * corrupted record be dropped instead of POSTed.
 */
export function parseVerifyBody(raw: string): VerifyIds | null {
  try {
    const parsed = JSON.parse(raw) as Partial<VerifyIds>;
    if (typeof parsed?.razorpay_payment_id !== 'string' || !parsed.razorpay_payment_id) return null;
    if (typeof parsed?.razorpay_order_id !== 'string' || !parsed.razorpay_order_id) return null;
    if (typeof parsed?.razorpay_signature !== 'string' || !parsed.razorpay_signature) return null;
    return {
      razorpay_payment_id: parsed.razorpay_payment_id,
      razorpay_order_id: parsed.razorpay_order_id,
      razorpay_signature: parsed.razorpay_signature,
    };
  } catch {
    return null;
  }
}

/**
 * The order the body describes, or null when it does not describe one
 * usefully. The body is this app's own serialization of what the shopper
 * submitted, and the server re-validates every field on replay — the checks
 * here only need to be strong enough that a corrupted record is dropped
 * instead of driving cart cleanup with garbage.
 */
function parseOrderSnapshot(body: string): PendingOrderSnapshot | null {
  try {
    const parsed = JSON.parse(body) as {
      orderData?: { cartItems?: unknown; shippingAddress?: unknown };
    };
    const rawItems = parsed?.orderData?.cartItems;
    if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
    const cartItems: { variantId: number; quantity: number }[] = [];
    for (const raw of rawItems) {
      const line = raw as { variantId?: unknown; quantity?: unknown };
      if (
        typeof line?.variantId !== 'number' ||
        !Number.isInteger(line.variantId) ||
        typeof line?.quantity !== 'number' ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0
      ) {
        return null;
      }
      cartItems.push({ variantId: line.variantId, quantity: line.quantity });
    }
    const address = parsed?.orderData?.shippingAddress as Partial<SnapshotAddress> | undefined;
    if (
      !address ||
      typeof address.firstName !== 'string' ||
      typeof address.lastName !== 'string' ||
      typeof address.address1 !== 'string' ||
      typeof address.city !== 'string' ||
      typeof address.state !== 'string' ||
      typeof address.pincode !== 'string' ||
      typeof address.country !== 'string'
    ) {
      return null;
    }
    return { cartItems, shippingAddress: address as SnapshotAddress };
  } catch {
    return null;
  }
}

/**
 * The stored pending verify, or null. A record that cannot be parsed is
 * removed on the spot: replaying an unusable body can never succeed, and
 * leaving it would block every future checkout in this tab.
 */
export function readPendingVerify(storage: PendingVerifyStorage | null): PendingVerify | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_VERIFY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { body?: unknown; at?: unknown };
    const body = typeof parsed?.body === 'string' ? parsed.body : null;
    const ids = body ? parseVerifyBody(body) : null;
    if (!body || !ids) throw new Error('unusable pending verify record');
    return {
      ids,
      body,
      at: typeof parsed.at === 'number' ? parsed.at : 0,
      snapshot: parseOrderSnapshot(body),
    };
  } catch {
    clearPendingVerify(storage, null);
    return null;
  }
}

/** Remember the body of a captured-but-unverified payment for the next visit. */
export function rememberPendingVerify(storage: PendingVerifyStorage | null, body: string): void {
  if (!storage) return;
  const ids = parseVerifyBody(body);
  if (!ids) return;
  try {
    storage.setItem(PENDING_VERIFY_KEY, JSON.stringify({ body, at: Date.now() }));
  } catch {
    // Storage unavailable (quota, private mode): the in-memory reconcile loop
    // in the caller still runs; only the cross-visit replay is lost.
  }
}

/**
 * Drop the stored body — but only when it belongs to `paymentId`, so clearing
 * after one checkout cannot discard a newer pending payment. `null` clears
 * whatever is stored (the unusable-record path above).
 */
export function clearPendingVerify(
  storage: PendingVerifyStorage | null,
  paymentId: string | null
): void {
  if (!storage) return;
  try {
    if (paymentId !== null) {
      const stored = readPendingVerify(storage);
      if (stored && stored.ids.razorpay_payment_id !== paymentId) return;
    }
    storage.removeItem(PENDING_VERIFY_KEY);
  } catch {
    // Ignore storage failures on the cleanup path.
  }
}

/** What one verify POST answered, reduced to what the replay decides on. */
export interface VerifyAttempt {
  ok: boolean;
  status: number;
  orderName: string | null;
  code: string | null;
}

export type PendingVerifyOutcome =
  | { kind: 'none' }
  | {
      kind: 'recovered';
      ids: VerifyIds;
      orderName: string;
      /**
       * The order the stored body describes, when it carries a usable one —
       * the checkout reconciles the cart against exactly these lines instead
       * of clearing whatever is in it.
       */
      snapshot: PendingOrderSnapshot | null;
    }
  | { kind: 'settled' }
  | { kind: 'blocked'; message: string };

/**
 * Shown when a stored payment cannot be resolved. It says explicitly that no
 * new payment was started, because that is the whole point of blocking.
 */
export const REPLAY_BLOCKED_MESSAGE =
  'We could not confirm your previous payment, so no new payment was started. Please try again in a moment, or check Account → Orders.';

/**
 * Codes that mean this payment can never produce an order: the server already
 * compensated it (refunded), or refused the request outright. The stored body
 * is dropped and a fresh checkout is safe.
 */
const SETTLED_CODES = new Set([
  'ORDER_REFUNDED', // route stamped the row refunded + cancelled
  'AMOUNT_MISMATCH', // refunded before this attempt could see it
  'OUT_OF_STOCK', // refunded before this attempt could see it
  'ORDER_NUMBER_OVERFLOW', // refunded
  // REFUND_FAILED is deliberately absent: the money is still captured, so the
  // body stays stored and each replay retries the refund server-side. The
  // replay settles once the refund lands (ORDER_REFUNDED, or a 402 when the
  // gateway no longer reports the payment as captured).
]);

/**
 * True when the server's answer proves there is no captured money left to
 * protect. Anything not listed here — 5xx, 409 ORDER_INCOMPLETE, a 400 whose
 * cause we cannot see — is treated as unresolved, never as "safe to charge".
 */
export function isSettledVerifyFailure(attempt: VerifyAttempt): boolean {
  if (attempt.code && SETTLED_CODES.has(attempt.code)) return true;
  // 402 without a code is 'Payment not captured': the gateway holds no
  // captured payment for these ids (capture never happened, or the refund
  // already landed), so nothing is left to protect.
  return attempt.status === 402;
}

/**
 * Re-POST the stored body, if any, and classify the answer. Never throws: a
 * transport failure is an outcome (`blocked`), not an error, because the
 * caller's next move depends on it.
 */
export async function reconcilePendingVerify(deps: {
  storage: PendingVerifyStorage | null;
  post: (body: string) => Promise<VerifyAttempt>;
}): Promise<PendingVerifyOutcome> {
  const pending = readPendingVerify(deps.storage);
  if (!pending) return { kind: 'none' };

  let attempt: VerifyAttempt;
  try {
    attempt = await deps.post(pending.body);
  } catch {
    // Timeout or dropped connection: the payment may have landed, so the body
    // stays stored for the next attempt.
    return { kind: 'blocked', message: REPLAY_BLOCKED_MESSAGE };
  }

  if (attempt.ok) {
    clearPendingVerify(deps.storage, pending.ids.razorpay_payment_id);
    return {
      kind: 'recovered',
      ids: pending.ids,
      orderName: attempt.orderName ?? '',
      snapshot: pending.snapshot,
    };
  }
  if (isSettledVerifyFailure(attempt)) {
    clearPendingVerify(deps.storage, pending.ids.razorpay_payment_id);
    return { kind: 'settled' };
  }
  return { kind: 'blocked', message: REPLAY_BLOCKED_MESSAGE };
}

/** One cart edit that reconciles the store's cart with a recovered order. */
export type RecoveredCartChange =
  | { kind: 'remove'; variantId: number }
  | { kind: 'update'; variantId: number; quantity: number };

/**
 * The cart edits a recovered order calls for: the order consumed the lines in
 * the stored body, but the shopper may have edited the cart since (a failed
 * verify never cleared it). A variant no longer in the cart is skipped, a
 * partially covered quantity is stepped down, a fully covered one is removed
 * — duplicate lines in the body sum first, and nothing here throws when the
 * cart no longer holds what was ordered.
 */
export function planRecoveredCartChanges(
  cartItems: { variantId: number; quantity: number }[],
  orderedLines: { variantId: number; quantity: number }[]
): RecoveredCartChange[] {
  const ordered = new Map<number, number>();
  for (const line of orderedLines) {
    ordered.set(line.variantId, (ordered.get(line.variantId) ?? 0) + line.quantity);
  }
  const changes: RecoveredCartChange[] = [];
  for (const [variantId, quantity] of ordered) {
    const inCart = cartItems.find((item) => item.variantId === variantId);
    if (!inCart) continue;
    const remaining = inCart.quantity - quantity;
    if (remaining > 0) {
      changes.push({ kind: 'update', variantId, quantity: remaining });
    } else {
      changes.push({ kind: 'remove', variantId });
    }
  }
  return changes;
}
