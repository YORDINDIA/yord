// Checkout-gate contract tests. Pure logic only: no live Razorpay/Supabase.
// - pricing + rate-limit: imported from the real modules.
// - HMAC compare, order-line bounds, search clamp: local pure mirrors of the
//   route logic (verify-payment/route.ts, create-order/route.ts,
//   search/route.ts). If a route changes its rule, update the mirror here.

import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  GST_RATE,
  MAX_ORDER_LINES,
  MAX_QTY_PER_LINE,
} from '@/lib/pricing';
import { EMAIL_RE, isRateLimited } from '@/lib/rate-limit';

// --- Local mirrors of route logic (kept in sync by contract) ---

function verifyHmacSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  // Mirrors checkout/verify-payment/route.ts constant-time comparison.
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(String(signature), 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;

function clampSearchLimit(raw: string | null): number {
  // Mirrors app/api/search/route.ts limit parsing.
  const parsed = parseInt(raw || String(SEARCH_DEFAULT_LIMIT), 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), SEARCH_MAX_LIMIT)
    : SEARCH_DEFAULT_LIMIT;
}

function isValidLineQty(qty: unknown): boolean {
  // Mirrors the per-line check in both checkout routes.
  return Number.isInteger(qty) && (qty as number) > 0 && (qty as number) <= MAX_QTY_PER_LINE;
}

describe('checkout gates', () => {
  it('computes 18% GST with paise total', () => {
    expect(GST_RATE).toBe(0.18);
    const { gstAmount, total, totalPaise } = computeTotals(1000);
    expect(gstAmount).toBe(180);
    expect(total).toBe(1180);
    expect(totalPaise).toBe(118000);
  });

  it('rounds fractional GST to the nearest rupee', () => {
    // 1999 * 0.18 = 359.82 -> 360
    const { gstAmount, total, totalPaise } = computeTotals(1999);
    expect(gstAmount).toBe(360);
    expect(total).toBe(2359);
    expect(totalPaise).toBe(235900);
    expect(computeTotals(0)).toEqual({ gstAmount: 0, total: 0, totalPaise: 0 });
  });

  it('enforces MAX_ORDER_LINES=50 and MAX_QTY_PER_LINE=10', () => {
    expect(MAX_ORDER_LINES).toBe(50);
    expect(MAX_QTY_PER_LINE).toBe(10);
    expect(isValidLineQty(1)).toBe(true);
    expect(isValidLineQty(10)).toBe(true);
    expect(isValidLineQty(0)).toBe(false);
    expect(isValidLineQty(11)).toBe(false);
    expect(isValidLineQty(1.5)).toBe(false);
    // Cart-size bound used by both checkout routes:
    expect(50 <= MAX_ORDER_LINES).toBe(true);
    expect(51 <= MAX_ORDER_LINES).toBe(false);
  });

  it('verifies HMAC in constant time; rejects tampered and short signatures', () => {
    const secret = 'test-secret';
    const genuine = crypto
      .createHmac('sha256', secret)
      .update('order_1|pay_1')
      .digest('hex');
    expect(verifyHmacSignature('order_1', 'pay_1', genuine, secret)).toBe(true);
    const tampered = genuine.slice(0, -1) + (genuine.endsWith('0') ? '1' : '0');
    expect(verifyHmacSignature('order_1', 'pay_1', tampered, secret)).toBe(false);
    expect(() => verifyHmacSignature('order_1', 'pay_1', 'short', secret)).not.toThrow();
    expect(verifyHmacSignature('order_1', 'pay_1', 'short', secret)).toBe(false);
    expect(verifyHmacSignature('order_1', 'pay_1', genuine, 'wrong-secret')).toBe(false);
  });

  it('rate-limits with a sliding window and validates emails', () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000)).toBe(true);
    expect(EMAIL_RE.test('buyer@example.in')).toBe(true);
    expect(EMAIL_RE.test('not-an-email')).toBe(false);
    expect(EMAIL_RE.test('a@b')).toBe(false);
  });

  it('clamps search limit to 1..50, defaulting to 20', () => {
    expect(clampSearchLimit(null)).toBe(20);
    expect(clampSearchLimit('5')).toBe(5);
    expect(clampSearchLimit('0')).toBe(1);
    expect(clampSearchLimit('-3')).toBe(1);
    expect(clampSearchLimit('999')).toBe(50);
    expect(clampSearchLimit('abc')).toBe(20);
  });
});
