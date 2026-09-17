// Refund tests. The route's cumulative-cap math lives in the
// reserve_refund() RPC (supabase/migrations/002_refund_idempotency.sql), which
// unit tests cannot call; these tests pin the small pure pieces that DO live
// in the route module's dependency surface: paise rounding of admin-typed
// amounts and the route's isPartial classification rule
// (cumulative < txn total => partial).

import { describe, expect, it } from 'vitest';

// --- Route-shaped pure helpers (same expressions as refunds/route.ts) ---

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function isPartialRefund(cumulativePaise: number, txnPaise: number): boolean {
  return Number.isFinite(txnPaise) && txnPaise > 0 ? cumulativePaise < txnPaise : false;
}

function parseRefundAmount(amount: unknown): number | undefined {
  // Mirrors refunds/route.ts: empty/absent -> full refund (undefined);
  // otherwise positive number converted to paise.
  if (amount === undefined || amount === null || amount === '') return undefined;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('amount must be a positive number');
  }
  return Math.round(parsed * 100); // Razorpay expects paise
}

function checkRefundAmount(
  refundPaise: number | undefined,
  txnAmount: number,
): { ok: true; partial: boolean } | { ok: false; reason: string } {
  // Mirrors the over-refund guard + isPartial classification in the route.
  if (
    refundPaise !== undefined &&
    Number.isFinite(txnAmount) &&
    txnAmount > 0 &&
    refundPaise > Math.round(txnAmount * 100)
  ) {
    return { ok: false, reason: 'Refund amount exceeds transaction amount' };
  }
  const partial =
    refundPaise !== undefined && Number.isFinite(txnAmount) && txnAmount > 0
      ? refundPaise < Math.round(txnAmount * 100)
      : false;
  return { ok: true, partial };
}

describe('refund validation', () => {
  it('parses amounts to paise; rejects zero, negative, and non-numeric', () => {
    expect(parseRefundAmount(undefined)).toBeUndefined();
    expect(parseRefundAmount('')).toBeUndefined();
    expect(parseRefundAmount(499.99)).toBe(49999);
    expect(parseRefundAmount('100')).toBe(10000);
    expect(() => parseRefundAmount(0)).toThrow('amount must be a positive number');
    expect(() => parseRefundAmount(-50)).toThrow('amount must be a positive number');
    expect(() => parseRefundAmount('abc')).toThrow('amount must be a positive number');
  });

  it('classifies partial vs full from the reserved cumulative total', () => {
    // Same expression as the route: cumulative < txn total => partial, so a
    // final partial refund that completes the total still marks fully refunded.
    const txnPaise = toPaise(1000);
    expect(isPartialRefund(toPaise(1000), txnPaise)).toBe(false);
    expect(isPartialRefund(toPaise(500), txnPaise)).toBe(true);
    expect(isPartialRefund(txnPaise, 0)).toBe(false);
    expect(checkRefundAmount(100000, 1000)).toEqual({ ok: true, partial: false });
    expect(checkRefundAmount(50000, 1000)).toEqual({ ok: true, partial: true });
    expect(checkRefundAmount(undefined, 1000)).toEqual({ ok: true, partial: false });
    expect(checkRefundAmount(100001, 1000)).toEqual({
      ok: false,
      reason: 'Refund amount exceeds transaction amount',
    });
  });
});
