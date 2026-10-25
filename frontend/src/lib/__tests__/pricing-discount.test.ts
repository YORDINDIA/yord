import { describe, expect, it } from 'vitest';
import {
  GST_RATE_HIGH,
  GST_RATE_LOW,
  MAX_DISCOUNT_PERCENT,
  clampDiscountPercent,
  computeTotals,
} from '@/lib/pricing';
import { validateCartLines } from '@/lib/validate-cart';
import { QUIZ_PERCENTAGES } from '@/features/quiz/config';

/**
 * The promo discount, against the same `computeTotals` the two checkout routes
 * charge from.
 *
 * Every assertion here is about money that leaves a real account, so the cases
 * are the ones a percentage discount gets wrong: rounding, GST extracted from
 * the *charged* amount rather than the list price, a percentage that is not a
 * number, and a code that would otherwise discount more than the cart is worth.
 *
 * The one thing not tested here is the lookup that decides whether a code is
 * usable — that is SQL (`peek_quiz_code` / `reserve_quiz_code` in migration
 * 018), and its JS side is exercised by the verify-payment suite.
 */

function stubSupabase(rows: Record<string, unknown>[]) {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as never;
}

describe('promo discount arithmetic', () => {
  it('leaves a cart with no code exactly where it was', () => {
    const withoutArgument = computeTotals([{ price: 1_999, quantity: 1 }]);
    const explicitZero = computeTotals([{ price: 1_999, quantity: 1 }], 0);
    expect(withoutArgument.discountAmount).toBe(0);
    expect(explicitZero).toEqual(withoutArgument);
    expect(explicitZero.total).toBe(1_999);
  });

  it('takes the percentage off the subtotal and charges the difference', () => {
    const ten = computeTotals([{ price: 1_000, quantity: 1 }], 10);
    expect(ten.discountAmount).toBe(100);
    expect(ten.total).toBe(900);

    const twenty = computeTotals([{ price: 1_000, quantity: 1 }], 20);
    expect(twenty.discountAmount).toBe(200);
    expect(twenty.total).toBe(800);

    const forty = computeTotals([{ price: 1_000, quantity: 1 }], 40);
    expect(forty.discountAmount).toBe(400);
    expect(forty.total).toBe(600);
  });

  it('rounds the discount to whole rupees so the charge is exact', () => {
    // 1499 * 40% = 599.6 -> 600, leaving 899. Razorpay is charged in paise, so
    // a fractional rupee would be an amount the gateway cannot express.
    const gold = computeTotals([{ price: 1_499, quantity: 1 }], 40);
    expect(gold.discountAmount).toBe(600);
    expect(gold.total).toBe(899);
    expect(gold.totalPaise).toBe(89_900);

    // 999 * 10% = 99.9 -> 100. Rounding *up* the discount is the direction that
    // costs margin; it is the direction `Math.round` takes, and it keeps
    // `discountAmount + total === subtotal` exactly.
    const bronze = computeTotals([{ price: 999, quantity: 1 }], 10);
    expect(bronze.discountAmount).toBe(100);
    expect(bronze.total).toBe(899);
    expect(bronze.discountAmount + bronze.total).toBe(bronze.subtotal);
  });

  it('keeps discount + total equal to subtotal for every tier and basket', () => {
    const baskets = [
      [{ price: 1, quantity: 1 }],
      [{ price: 333, quantity: 3 }],
      [{ price: 2_499, quantity: 1 }, { price: 2_501, quantity: 2 }],
      [{ price: 12_345, quantity: 7 }],
    ];
    for (const basket of baskets) {
      for (const percent of QUIZ_PERCENTAGES) {
        const totals = computeTotals(basket, percent);
        // The invariant that makes the discount auditable: what came off plus
        // what was charged is what the cart said it cost.
        expect(totals.discountAmount + totals.total).toBe(totals.subtotal);
        expect(Number.isInteger(totals.discountAmount)).toBe(true);
        expect(Number.isInteger(totals.total)).toBe(true);
        expect(totals.totalPaise).toBe(totals.total * 100);
      }
    }
  });

  it('extracts GST from what is charged, not from the list price', () => {
    // 1000 -> 800 at 20% off. GST contained in 800 at 5% is 800 - 800/1.05 =
    // 38.10 -> 38. Extracting from the undiscounted 1000 would claim 48, i.e.
    // tax on money the shop never received.
    const discounted = computeTotals([{ price: 1_000, quantity: 1 }], 20);
    expect(discounted.gstAmount).toBe(38);
    expect(discounted.gstAmount).toBeLessThan(
      computeTotals([{ price: 1_000, quantity: 1 }]).gstAmount,
    );
    // It is still a component of the total, never an addition.
    expect(discounted.total).toBe(800);
  });

  it('keeps each line on its own GST slab after the discount', () => {
    // One ₹2,000 piece (5%) and one ₹3,000 piece (18%), 40% off.
    // 5000 * 40% = 2000 off, so 3000 is charged and every line scales by 0.6:
    //   2000 * 0.6 = 1200 -> 1200 - 1200/1.05 = 57.14 -> 57
    //   3000 * 0.6 = 1800 -> 1800 - 1800/1.18 = 274.58 -> 275
    const totals = computeTotals(
      [
        { price: 2_000, quantity: 1 },
        { price: 3_000, quantity: 1 },
      ],
      40,
    );
    expect(totals.discountAmount).toBe(2_000);
    expect(totals.total).toBe(3_000);
    expect(totals.gstAmount).toBe(57 + 275);
  });

  it('prices an empty cart at zero however large the code is', () => {
    for (const percent of QUIZ_PERCENTAGES) {
      const totals = computeTotals([], percent);
      expect(totals).toEqual({
        subtotal: 0,
        discountAmount: 0,
        gstAmount: 0,
        total: 0,
        totalPaise: 0,
      });
    }
  });
});

describe('the discount guard', () => {
  it('reads a non-number as no discount at all', () => {
    // The direction that matters: a bad value from a caller under-charges the
    // shopper rather than giving the shop away.
    expect(clampDiscountPercent(Number.NaN)).toBe(0);
    expect(clampDiscountPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampDiscountPercent(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clampDiscountPercent(-20)).toBe(0);
    expect(clampDiscountPercent(0)).toBe(0);
  });

  it('caps the discount at the ceiling, so a bug cannot be a giveaway', () => {
    expect(clampDiscountPercent(10)).toBe(10);
    expect(clampDiscountPercent(MAX_DISCOUNT_PERCENT)).toBe(MAX_DISCOUNT_PERCENT);
    expect(clampDiscountPercent(MAX_DISCOUNT_PERCENT + 1)).toBe(MAX_DISCOUNT_PERCENT);
    expect(clampDiscountPercent(100)).toBe(MAX_DISCOUNT_PERCENT);
    expect(clampDiscountPercent(100_000)).toBe(MAX_DISCOUNT_PERCENT);
    // A cart can never be discounted to nothing, let alone to a negative total.
    const capped = computeTotals([{ price: 1_000, quantity: 1 }], 1_000);
    expect(capped.total).toBe(100);
    expect(capped.total).toBeGreaterThan(0);
  });

  it('floors a fractional percentage rather than rounding it up', () => {
    expect(clampDiscountPercent(12.9)).toBe(12);
    expect(clampDiscountPercent(0.5)).toBe(0);
  });

  it('never charges more than the subtotal, at any percentage', () => {
    for (let percent = 0; percent <= 120; percent += 1) {
      const totals = computeTotals([{ price: 777, quantity: 3 }], percent);
      expect(totals.discountAmount).toBeLessThanOrEqual(totals.subtotal);
      expect(totals.total).toBeGreaterThanOrEqual(0);
      expect(totals.gstAmount).toBeLessThanOrEqual(totals.total);
    }
  });

  it('leaves the GST rate constants alone', () => {
    // Guards against a future edit that "simplifies" the slab table while
    // touching this file: the two rates are a compliance fact, not a preference.
    expect(GST_RATE_LOW).toBe(0.05);
    expect(GST_RATE_HIGH).toBe(0.18);
  });
});

describe('validateCartLines carries the discount through', () => {
  const rows = [
    {
      id: 1,
      price: 1_000,
      inventory_quantity: 10,
      title: 'M',
      product_id: 7,
      products: { title: 'Tee', status: 'active' },
    },
  ];

  it('defaults to no discount when the caller passes no percentage', async () => {
    const validated = await validateCartLines(stubSupabase(rows), [{ variantId: 1, quantity: 1 }]);
    // `expect` does not narrow the union for the compiler, so assert the
    // discriminant and then narrow for real.
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(`expected ok, got ${validated.code}`);
    expect(validated.discountAmount).toBe(0);
    expect(validated.total).toBe(1_000);
  });

  it('returns the discounted total and the amount taken off', async () => {
    const validated = await validateCartLines(
      stubSupabase(rows),
      [{ variantId: 1, quantity: 2 }],
      40,
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(`expected ok, got ${validated.code}`);
    expect(validated.subtotal).toBe(2_000);
    expect(validated.discountAmount).toBe(800);
    expect(validated.total).toBe(1_200);
    expect(validated.totalPaise).toBe(120_000);
    // `byId` keeps the catalog price, undiscounted, and that is deliberate: the
    // order's line items record what each piece was listed at, and the discount
    // is recorded once on the order. So the order row satisfies
    // `subtotal_price - total_discounts = total_price`, the Shopify shape the
    // admin order page reads.
    const lineSum = validated.byId.get(1)!.price * 2;
    expect(lineSum).toBe(2_000);
    expect(lineSum - validated.discountAmount).toBe(validated.total);
  });
});
