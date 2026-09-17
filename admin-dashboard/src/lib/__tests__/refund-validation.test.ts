// Refund-validation contract tests. Pure logic only: no live Razorpay/Supabase.
// Local pure mirrors of app/api/refunds/route.ts amount parsing, the
// over-refund guard, and the partial-vs-full classification. If the route
// changes its rule, update the mirror here.

import { describe, expect, it } from 'vitest';

// --- Local mirrors of route logic (kept in sync by contract) ---

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

  it('rejects over-refunds and classifies partial vs full', () => {
    expect(checkRefundAmount(100000, 1000)).toEqual({ ok: true, partial: false });
    expect(checkRefundAmount(50000, 1000)).toEqual({ ok: true, partial: true });
    expect(checkRefundAmount(undefined, 1000)).toEqual({ ok: true, partial: false });
    expect(checkRefundAmount(100001, 1000)).toEqual({
      ok: false,
      reason: 'Refund amount exceeds transaction amount',
    });
  });
});
