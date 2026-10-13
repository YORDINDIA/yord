// The pending-verify reconcile contract (src/features/checkout/pendingVerify.ts).
//
// This module is the fix for a captured payment whose verify call never got an
// answer: the stored body is re-POSTed before a new Razorpay order is created,
// and a failed replay is classified into "settled" (safe to charge again) or
// "blocked" (do NOT charge again). The classification is a money decision, so
// it is tested directly — the hook that calls it cannot be rendered in this
// suite (node environment, no DOM, no new dependencies), which is the one gap
// this file cannot close.
//
// The module is new, so there is no old implementation for these tests to fail
// against; what they pin is the behaviour the old code lacked entirely (it
// wrote the record and never read it).

import { describe, expect, it, vi } from 'vitest';
import {
  clearPendingVerify,
  isSettledVerifyFailure,
  parseVerifyBody,
  PENDING_VERIFY_KEY,
  planRecoveredCartChanges,
  readPendingVerify,
  reconcilePendingVerify,
  rememberPendingVerify,
  REPLAY_BLOCKED_MESSAGE,
  type PendingVerifyStorage,
  type VerifyAttempt,
} from '@/features/checkout/pendingVerify';

function fakeStorage(): PendingVerifyStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

function verifyBody(paymentId = 'pay_TEST0001'): string {
  return JSON.stringify({
    razorpay_order_id: `order_for_${paymentId}`,
    razorpay_payment_id: paymentId,
    razorpay_signature: 'signature',
    analyticsSid: '11111111-2222-4333-8444-555555555555',
    orderData: { email: 'buyer@example.in' },
  });
}

/** A body carrying the full orderData the hook serializes at payment time. */
function verifyBodyWithSnapshot(paymentId = 'pay_SNAP0001'): string {
  return JSON.stringify({
    razorpay_order_id: `order_for_${paymentId}`,
    razorpay_payment_id: paymentId,
    razorpay_signature: 'signature',
    analyticsSid: '11111111-2222-4333-8444-555555555555',
    orderData: {
      email: 'buyer@example.in',
      phone: '9876543210',
      shippingAddress: {
        firstName: 'A',
        lastName: 'B',
        address1: '1 Road',
        address2: '',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        country: 'India',
      },
      cartItems: [
        { variantId: 11, quantity: 2 },
        { variantId: 12, quantity: 1 },
      ],
    },
  });
}

function attempt(overrides: Partial<VerifyAttempt> = {}): VerifyAttempt {
  return { ok: false, status: 500, orderName: null, code: null, ...overrides };
}

describe('pending verify storage', () => {
  it('round-trips a stored body and reads its ids back', () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());

    const pending = readPendingVerify(storage);
    expect(pending?.body).toBe(verifyBody());
    expect(pending?.ids).toEqual({
      razorpay_payment_id: 'pay_TEST0001',
      razorpay_order_id: 'order_for_pay_TEST0001',
      razorpay_signature: 'signature',
    });
  });

  it('drops a record it cannot parse instead of replaying it forever', () => {
    const storage = fakeStorage();
    storage.setItem(PENDING_VERIFY_KEY, JSON.stringify({ body: '{"not":"a verify body"}', at: 1 }));
    expect(readPendingVerify(storage)).toBeNull();
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);

    // Not even JSON: still dropped, still no throw.
    storage.setItem(PENDING_VERIFY_KEY, 'not json at all');
    expect(readPendingVerify(storage)).toBeNull();
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);
  });

  it('refuses to store a body without Razorpay ids', () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, JSON.stringify({ razorpay_payment_id: 'pay_x' }));
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);
  });

  it('clears only the payment it was asked to clear', () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody('pay_OLD'));
    clearPendingVerify(storage, 'pay_NEW');
    // A clear for another checkout must not discard this pending payment.
    expect(readPendingVerify(storage)?.ids.razorpay_payment_id).toBe('pay_OLD');
    clearPendingVerify(storage, 'pay_OLD');
    expect(readPendingVerify(storage)).toBeNull();
  });

  it('tolerates a missing storage (SSR, private mode)', () => {
    expect(() => rememberPendingVerify(null, verifyBody())).not.toThrow();
    expect(readPendingVerify(null)).toBeNull();
    expect(() => clearPendingVerify(null, 'pay_TEST0001')).not.toThrow();
  });

  it('parses only bodies that carry all three ids', () => {
    expect(parseVerifyBody(verifyBody())?.razorpay_payment_id).toBe('pay_TEST0001');
    expect(parseVerifyBody('{}')).toBeNull();
    expect(
      parseVerifyBody(
        JSON.stringify({ razorpay_payment_id: 'p', razorpay_order_id: 'o', razorpay_signature: 42 })
      )
    ).toBeNull();
  });
});

describe('isSettledVerifyFailure', () => {
  it('treats compensation codes and a 402 as settled', () => {
    for (const code of [
      'ORDER_REFUNDED',
      'AMOUNT_MISMATCH',
      'OUT_OF_STOCK',
      'ORDER_NUMBER_OVERFLOW',
      'UNKNOWN_VARIANT',
      'BAD_AMOUNT',
    ]) {
      expect(isSettledVerifyFailure(attempt({ status: 500, code }))).toBe(true);
    }
    // 402 without a code is 'Payment not captured'.
    expect(isSettledVerifyFailure(attempt({ status: 402 }))).toBe(true);
  });

  it('does not treat an unresolved answer as settled', () => {
    expect(isSettledVerifyFailure(attempt({ status: 500 }))).toBe(false);
    // Captured money the refund did not return: never safe to charge again.
    expect(isSettledVerifyFailure(attempt({ status: 500, code: 'REFUND_FAILED' }))).toBe(false);
    expect(isSettledVerifyFailure(attempt({ status: 409, code: 'ORDER_CANCELLED' }))).toBe(false);
    expect(isSettledVerifyFailure(attempt({ status: 409, code: 'ORDER_INCOMPLETE' }))).toBe(false);
    expect(isSettledVerifyFailure(attempt({ status: 502, code: 'PAYMENT_FETCH_FAILED' }))).toBe(false);
  });
});

describe('reconcilePendingVerify', () => {
  it('does nothing when there is no stored payment', async () => {
    const post = vi.fn();
    const outcome = await reconcilePendingVerify({ storage: fakeStorage(), post });
    expect(outcome).toEqual({ kind: 'none' });
    expect(post).not.toHaveBeenCalled();
  });

  it('re-POSTs the stored body verbatim and resolves the checkout on success', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => attempt({ ok: true, status: 200, orderName: 'YORD-1-ABCD' }));

    const outcome = await reconcilePendingVerify({ storage, post });

    // Same bytes: the server's confirmation_number idempotency depends on it.
    expect(post).toHaveBeenCalledWith(verifyBody());
    expect(outcome).toEqual({
      kind: 'recovered',
      ids: {
        razorpay_payment_id: 'pay_TEST0001',
        razorpay_order_id: 'order_for_pay_TEST0001',
        razorpay_signature: 'signature',
      },
      orderName: 'YORD-1-ABCD',
      // This body carries no usable orderData, so there is no snapshot to
      // reconcile the cart with.
      snapshot: null,
    });
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);
  });

  it('exposes the original cart lines and shipping address on a recovered body', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBodyWithSnapshot());
    const post = vi.fn(async () => attempt({ ok: true, status: 200, orderName: 'YORD-2-BEEF' }));

    const outcome = await reconcilePendingVerify({ storage, post });

    expect(outcome.kind).toBe('recovered');
    if (outcome.kind !== 'recovered') return;
    // The snapshot is exactly what the shopper ordered when the first verify
    // was lost — the cart cleanup is driven by these ids, not by the cart's
    // current contents.
    expect(outcome.snapshot).toEqual({
      cartItems: [
        { variantId: 11, quantity: 2 },
        { variantId: 12, quantity: 1 },
      ],
      shippingAddress: {
        firstName: 'A',
        lastName: 'B',
        address1: '1 Road',
        address2: '',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        country: 'India',
      },
    });
  });

  it('carries a null snapshot when the body has no usable orderData', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(
      storage,
      JSON.stringify({
        razorpay_order_id: 'order_x',
        razorpay_payment_id: 'pay_x',
        razorpay_signature: 'signature',
        orderData: { email: 'buyer@example.in', cartItems: [{ variantId: 'nope' }] },
      })
    );
    const post = vi.fn(async () => attempt({ ok: true, status: 200, orderName: 'YORD-3-CAFE' }));

    const outcome = await reconcilePendingVerify({ storage, post });

    // Still recovered — the order exists — but the checkout falls back to its
    // own cleanup instead of trusting a half-parsed snapshot.
    expect(outcome).toMatchObject({ kind: 'recovered', snapshot: null });
  });

  it('clears a settled payment so the next checkout is not blocked', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => attempt({ status: 409, code: 'ORDER_REFUNDED' }));

    const outcome = await reconcilePendingVerify({ storage, post });

    expect(outcome).toEqual({ kind: 'settled' });
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);
  });

  it('clears when the gateway has no captured payment for the stored ids', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => attempt({ status: 402, code: null }));

    expect(await reconcilePendingVerify({ storage, post })).toEqual({ kind: 'settled' });
    expect(storage.map.has(PENDING_VERIFY_KEY)).toBe(false);
  });

  it('blocks the next charge and keeps the body when the server fails', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => attempt({ status: 500 }));

    const outcome = await reconcilePendingVerify({ storage, post });

    expect(outcome).toEqual({ kind: 'blocked', message: REPLAY_BLOCKED_MESSAGE });
    // The whole point: a failed replay must not lose the payment.
    expect(readPendingVerify(storage)?.body).toBe(verifyBody());
  });

  it('blocks the next charge and keeps the body when the request times out', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => {
      throw new DOMException('The operation timed out', 'TimeoutError');
    });

    const outcome = await reconcilePendingVerify({ storage, post });

    expect(outcome).toEqual({ kind: 'blocked', message: REPLAY_BLOCKED_MESSAGE });
    expect(readPendingVerify(storage)?.body).toBe(verifyBody());
  });

  it('blocks and keeps the body when fetch rejects with a network TypeError', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const outcome = await reconcilePendingVerify({ storage, post });

    expect(outcome).toEqual({ kind: 'blocked', message: REPLAY_BLOCKED_MESSAGE });
    expect(readPendingVerify(storage)?.body).toBe(verifyBody());
  });

  it('blocks while another attempt is mid-flight', async () => {
    const storage = fakeStorage();
    rememberPendingVerify(storage, verifyBody());
    const post = vi.fn(async () => attempt({ status: 409, code: 'ORDER_INCOMPLETE' }));

    expect(await reconcilePendingVerify({ storage, post })).toEqual({
      kind: 'blocked',
      message: REPLAY_BLOCKED_MESSAGE,
    });
    expect(readPendingVerify(storage)?.body).toBe(verifyBody());
  });
});

describe('planRecoveredCartChanges', () => {
  it('removes fully covered lines and steps down partially covered ones', () => {
    const cart = [
      { variantId: 11, quantity: 3 },
      { variantId: 12, quantity: 1 },
    ];
    const ordered = [
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ];
    expect(planRecoveredCartChanges(cart, ordered)).toEqual([
      { kind: 'update', variantId: 11, quantity: 1 },
      { kind: 'remove', variantId: 12 },
    ]);
  });

  it('skips variants that are no longer in the cart instead of throwing', () => {
    const cart = [{ variantId: 11, quantity: 1 }];
    const ordered = [
      { variantId: 11, quantity: 2 },
      { variantId: 12, quantity: 1 },
    ];
    // Line 12 is gone from the cart entirely; line 11 is over-covered, so it
    // is removed rather than stepped to a negative count.
    expect(planRecoveredCartChanges(cart, ordered)).toEqual([{ kind: 'remove', variantId: 11 }]);
    expect(planRecoveredCartChanges([], ordered)).toEqual([]);
  });

  it('sums duplicate ordered lines before reconciling', () => {
    const cart = [{ variantId: 11, quantity: 4 }];
    const ordered = [
      { variantId: 11, quantity: 1 },
      { variantId: 11, quantity: 2 },
    ];
    expect(planRecoveredCartChanges(cart, ordered)).toEqual([
      { kind: 'update', variantId: 11, quantity: 1 },
    ]);
  });
});
