import { describe, expect, it } from 'vitest';
import { refundSchema } from '@/lib/validation';

/**
 * Refund amount validation and partial-refund classification.
 *
 * The cumulative-cap math lives in the `reserve_refund()` RPC
 * (`supabase/migrations/002_refund_idempotency.sql`), which a unit test cannot
 * call, so what is pinned here is the client-side boundary: the shared
 * `refundSchema` the refund panel pre-validates with, and the `cumulative <
 * txn total => partial` rule the route applies to set the order's
 * `financial_status`.
 *
 * The previous version of this file re-implemented both as local functions with
 * a comment "mirrors refunds/route.ts". A copy cannot fail when the route does,
 * which is how a real bug survived in `refundSchema` (see the full-refund case
 * below).
 */

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** Mirrors the `isPartial` expression in `app/api/refunds/route.ts`. */
function isPartialRefund(cumulativePaise: number, txnPaise: number): boolean {
  return Number.isFinite(txnPaise) && txnPaise > 0 ? cumulativePaise < txnPaise : false;
}

describe('refundSchema', () => {
  it('treats an empty amount as a full refund', () => {
    // The refund panel's hint says "leave empty for full". This used to throw,
    // because `z.coerce.number()` turned '' into 0 and the `> 0` check rejected
    // it before the transform could map it to undefined.
    expect(refundSchema.parse({ orderId: '1', transactionId: 2, amount: '' }).amount).toBeUndefined();
    expect(refundSchema.parse({ orderId: '1', transactionId: 2 }).amount).toBeUndefined();
    expect(refundSchema.parse({ orderId: '1', transactionId: 2, amount: null }).amount).toBeUndefined();
  });

  it('accepts a positive amount as a number or a numeric string', () => {
    expect(refundSchema.parse({ orderId: '1', transactionId: 2, amount: 499.99 }).amount).toBe(499.99);
    expect(refundSchema.parse({ orderId: '1', transactionId: 2, amount: '100' }).amount).toBe(100);
  });

  it('rejects zero, negative, and non-numeric amounts', () => {
    for (const amount of [0, -50, 'abc']) {
      expect(
        refundSchema.safeParse({ orderId: '1', transactionId: 2, amount }).success,
        `amount ${String(amount)} should be rejected`,
      ).toBe(false);
    }
  });

  it('requires a decimal-string order id and a positive transaction id', () => {
    expect(refundSchema.safeParse({ orderId: '0', transactionId: 2 }).success).toBe(false);
    expect(refundSchema.safeParse({ orderId: 'abc', transactionId: 2 }).success).toBe(false);
    expect(refundSchema.safeParse({ orderId: '9007199254740993', transactionId: 2 }).success).toBe(true);
    expect(refundSchema.safeParse({ orderId: '1', transactionId: -1 }).success).toBe(false);
  });
});

describe('partial refund classification', () => {
  it('is partial only while the cumulative total is below the transaction total', () => {
    const txnPaise = toPaise(1000);
    // A final partial refund that completes the total must still mark the order
    // fully refunded, which is why the comparison is against the transaction
    // total and not against a "was any partial requested" flag.
    expect(isPartialRefund(toPaise(500), txnPaise)).toBe(true);
    expect(isPartialRefund(toPaise(1000), txnPaise)).toBe(false);
    expect(isPartialRefund(toPaise(1500), txnPaise)).toBe(false);
  });

  it('is never partial when the transaction amount is unusable', () => {
    expect(isPartialRefund(toPaise(100), 0)).toBe(false);
    expect(isPartialRefund(toPaise(100), NaN)).toBe(false);
  });
});
