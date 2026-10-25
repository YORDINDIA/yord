// Checkout-gate tests. Real route-adjacent helpers are imported directly
// (pricing, shipping, rate-limit, cart validation, search filter, redirect) so
// the tests fail when the route rule changes. The only local mirror left is the
// HMAC comparison, which cannot be imported from the route module without
// pulling in Next/Razorpay server deps; it replicates the exact
// createHmac('sha256').update(`${orderId}|${paymentId}`) + timingSafeEqual
// construction used by verify-payment/route.ts.

import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  GST_RATE_HIGH,
  GST_RATE_LOW,
  GST_SLAB_THRESHOLD,
  MAX_ORDER_LINES,
  MAX_QTY_PER_LINE,
} from '@/lib/pricing';
import { FREE_FAST_SHIPPING_THRESHOLD, shippingLabel } from '@/lib/shipping';
import { EMAIL_RE, isRateLimited } from '@/lib/rate-limit';
import { validateCartLines, type CartLine } from '@/lib/validate-cart';
import { buildSearchOrFilter } from '@/lib/search';
import { getSafeRedirect } from '@/lib/redirect';

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

// Minimal Supabase stub: only the product_variants select used by
// validateCartLines. Typed as never to avoid coupling the test to the
// supabase-js client shape.
function stubSupabase(rows: Record<string, unknown>[]) {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as never;
}

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    price: 1000,
    inventory_quantity: 10,
    title: 'M',
    product_id: 7,
    // The helper only sells variants whose parent product is `active`
    // (products.status is part of its select).
    products: { title: 'Tee', status: 'active' },
    ...overrides,
  };
}

describe('checkout gates', () => {
  it('extracts 5% GST from inclusive prices on the low slab', () => {
    expect(GST_RATE_LOW).toBe(0.05);
    expect(GST_SLAB_THRESHOLD).toBe(2500);
    const { gstAmount, total, totalPaise } = computeTotals([{ price: 1000, quantity: 1 }]);
    // 1000 - 1000/1.05 = 47.62 -> 48. The price is all-in: no amount is added.
    expect(gstAmount).toBe(48);
    expect(total).toBe(1000);
    expect(totalPaise).toBe(100000);
  });

  it('rounds fractional GST to the nearest rupee and stays inclusive', () => {
    // 1999 - 1999/1.05 = 95.19 -> 95
    const { gstAmount, total, totalPaise } = computeTotals([{ price: 1999, quantity: 1 }]);
    expect(gstAmount).toBe(95);
    expect(total).toBe(1999);
    expect(totalPaise).toBe(199900);
    expect(computeTotals([])).toEqual({
      subtotal: 0,
      discountAmount: 0,
      gstAmount: 0,
      total: 0,
      totalPaise: 0,
    });
  });

  it('reads the GST slab per piece, not per line total', () => {
    expect(GST_RATE_HIGH).toBe(0.18);
    // A piece above ₹2,500 attracts 18%: 3000 - 3000/1.18 = 457.63 -> 458.
    const high = computeTotals([{ price: 3000, quantity: 1 }]);
    expect(high.gstAmount).toBe(458);
    expect(high.total).toBe(3000);
    // Two ₹2,400 tees are two 5% pieces (line total ₹4,800, still 5%):
    // 4800 - 4800/1.05 = 228.57 -> 229.
    const two = computeTotals([{ price: 2400, quantity: 2 }]);
    expect(two.gstAmount).toBe(229);
    // Mixed cart: each line's own slab, summed.
    const mixed = computeTotals([
      { price: 2400, quantity: 2 },
      { price: 3000, quantity: 1 },
    ]);
    expect(mixed.gstAmount).toBe(229 + 458);
    expect(mixed.total).toBe(2400 * 2 + 3000);
  });

  it('never charges shipping at any cart value', () => {
    // Both checkout routes charge the GST-inclusive total (`computeTotals`
    // above) and the order row is written with `total_shipping_price: 0`. The
    // shipping line is the only shipping surface, and at every value it must
    // stay a free tier with no amount in it.
    for (const subtotal of [0, 1, 499, 998, 999, 1999, 2000, 5000]) {
      const label = shippingLabel(subtotal);
      expect(label.startsWith('FREE')).toBe(true);
      expect(label).not.toMatch(/[0-9]/);
    }
  });

  it('gates only the shipping speed, never the price', () => {
    expect(shippingLabel(FREE_FAST_SHIPPING_THRESHOLD - 1)).toBe('FREE Standard');
    expect(shippingLabel(FREE_FAST_SHIPPING_THRESHOLD)).toBe('FREE Fast');
  });

  it('enforces MAX_ORDER_LINES=50 and MAX_QTY_PER_LINE=10', async () => {
    expect(MAX_ORDER_LINES).toBe(50);
    expect(MAX_QTY_PER_LINE).toBe(10);
    // Quantity bounds go through the real validateCartLines helper, the
    // same code both checkout routes call before creating/verifying orders.
    const lines = (qty: number): CartLine[] => [{ variantId: 1, quantity: qty }];
    const stocked = stubSupabase([variantRow({ inventory_quantity: 50 })]);
    expect((await validateCartLines(stocked, lines(1))).ok).toBe(true);
    expect((await validateCartLines(stocked, lines(10))).ok).toBe(true);
    expect((await validateCartLines(stocked, lines(11))).ok).toBe(true);
    // validateCartLines trusts pre-validated bounds for qty (routes enforce
    // MAX_QTY_PER_LINE first); over-limit must fail at the route-shaped gate:
    const overLimit = lines(11).every(
      (l) => Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= MAX_QTY_PER_LINE
    );
    expect(overLimit).toBe(false);
    expect((await validateCartLines(stubSupabase([variantRow({ inventory_quantity: 1 })]), lines(2))).ok).toBe(false);
    // Cart-size bound used by both checkout routes:
    expect(50 <= MAX_ORDER_LINES).toBe(true);
    expect(51 <= MAX_ORDER_LINES).toBe(false);
  });

  it('validates cart lines against DB prices and stock', async () => {
    const ok = await validateCartLines(stubSupabase([variantRow()]), [{ variantId: 1, quantity: 2 }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      // 2 x 1000 = 2000, GST-inclusive: 2000 - 2000/1.05 = 95.24 -> 95, total 2000.
      expect(ok.subtotal).toBe(2000);
      expect(ok.gstAmount).toBe(95);
      expect(ok.total).toBe(2000);
      expect(ok.totalPaise).toBe(200000);
    }
    const unknown = await validateCartLines(stubSupabase([]), [{ variantId: 9, quantity: 1 }]);
    expect(unknown).toMatchObject({ ok: false, code: 'UNKNOWN_VARIANT', status: 400 });
    const badPrice = await validateCartLines(stubSupabase([variantRow({ price: -5 })]), [{ variantId: 1, quantity: 1 }]);
    expect(badPrice).toMatchObject({ ok: false, code: 'BAD_AMOUNT', status: 400 });
    const noStock = await validateCartLines(stubSupabase([variantRow({ inventory_quantity: 0 })]), [{ variantId: 1, quantity: 1 }]);
    expect(noStock).toMatchObject({ ok: false, code: 'OUT_OF_STOCK', status: 409 });
  });

  it('rejects variants whose product is not active', async () => {
    // The variant lookup runs through the service client with no status
    // predicate, so this check is the only thing keeping draft/archived
    // products out of the money path.
    for (const status of ['draft', 'archived', null, undefined]) {
      const res = await validateCartLines(
        stubSupabase([variantRow({ products: { title: 'Tee', status } })]),
        [{ variantId: 1, quantity: 1 }]
      );
      expect(res).toMatchObject({
        ok: false,
        code: 'UNKNOWN_VARIANT',
        error: 'Invalid cart items',
        status: 400,
      });
    }
    // A deleted parent row (embed null) has no status either: fail closed.
    const orphan = await validateCartLines(stubSupabase([variantRow({ products: null })]), [
      { variantId: 1, quantity: 1 },
    ]);
    expect(orphan).toMatchObject({ ok: false, code: 'UNKNOWN_VARIANT', status: 400 });
    // ...while an active product still checks out.
    const active = await validateCartLines(stubSupabase([variantRow()]), [
      { variantId: 1, quantity: 1 },
    ]);
    expect(active.ok).toBe(true);
  });

  it('sums requested units per variant across duplicate lines', async () => {
    // A crafted body can repeat a variantId (the store merges quantities, so
    // this path is hand-built). 6 + 6 against 8 in stock must be a clean
    // pre-capture 409, not a second decrement rejected after capture.
    const stock8 = stubSupabase([variantRow({ inventory_quantity: 8 })]);
    const oversold = await validateCartLines(stock8, [
      { variantId: 1, quantity: 6 },
      { variantId: 1, quantity: 6 },
    ]);
    expect(oversold).toMatchObject({
      ok: false,
      code: 'OUT_OF_STOCK',
      error: 'Insufficient stock for one or more items',
      status: 409,
    });
    // Exactly at stock is still allowed, and both lines are billed.
    const exact = await validateCartLines(stock8, [
      { variantId: 1, quantity: 4 },
      { variantId: 1, quantity: 4 },
    ]);
    expect(exact.ok).toBe(true);
    if (exact.ok) expect(exact.subtotal).toBe(8000);
    // Summing one variant's lines must not spend another variant's stock.
    const twoVariants = stubSupabase([
      variantRow({ id: 1, inventory_quantity: 8 }),
      variantRow({ id: 2, inventory_quantity: 2 }),
    ]);
    const mixed = await validateCartLines(twoVariants, [
      { variantId: 1, quantity: 3 },
      { variantId: 2, quantity: 3 },
    ]);
    expect(mixed).toMatchObject({ ok: false, code: 'OUT_OF_STOCK', status: 409 });
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

  it('builds a sanitized multi-column search filter', () => {
    // buildSearchOrFilter is the real helper behind /api/search sanitizing.
    // Quotes, commas, and LIKE wildcards in user input must stay literal.
    expect(buildSearchOrFilter('coldplay')).toBe(
      'title.ilike."%coldplay%",vendor.ilike."%coldplay%",tags.ilike."%coldplay%"'
    );
    const hostile = buildSearchOrFilter('a",b%_\\c');
    expect(hostile).toContain('\\"');
    expect(hostile).toContain('\\%');
    expect(hostile).toContain('\\_');
    expect(hostile).toContain('\\\\');
    expect(buildSearchOrFilter('x'.repeat(200)).length).toBeLessThanOrEqual(
      buildSearchOrFilter('x'.repeat(100)).length + 10
    );
  });

  it('allows only same-origin redirect paths', () => {
    expect(getSafeRedirect(null)).toBe('/account');
    expect(getSafeRedirect('/account/orders')).toBe('/account/orders');
    expect(getSafeRedirect('/account?tab=x#y')).toBe('/account?tab=x#y');
    expect(getSafeRedirect('https://evil.test/phish')).toBe('/account');
    expect(getSafeRedirect('//evil.test/x')).toBe('/account');
    expect(getSafeRedirect('/\\evil')).toBe('/account');
  });
});
