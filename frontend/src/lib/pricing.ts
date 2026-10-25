// Server-side money math. Both checkout routes recompute totals from DB
// variant prices so client-supplied amounts are display-only.
//
// Catalog prices are GST-INCLUSIVE (owner decision, Oct 2026): the variant
// price is what the shopper pays, so `total` equals the subtotal and GST is
// *extracted* from it for the order record — never added on top. That is also
// what Google Merchant Center requires for India: the feed price must include
// GST and match the price on the landing page.
//
// The rate depends on the per-piece price: garments up to ₹2,500 attract 5%,
// above that 18%. The slab reads the UNIT price, not the line total — two
// ₹2,400 tees are two 5%-slab pieces (₹4,800), not one 18% line.

/** GST rate for one piece priced at or below `GST_SLAB_THRESHOLD`. */
export const GST_RATE_LOW = 0.05;

/** GST rate for one piece priced above `GST_SLAB_THRESHOLD`. */
export const GST_RATE_HIGH = 0.18;

/** Per-piece price boundary between the two GST slabs (rupees). */
export const GST_SLAB_THRESHOLD = 2500;

export const MAX_ORDER_LINES = 50;
export const MAX_QTY_PER_LINE = 10;

export interface PricedLine {
  /** Unit price, GST-inclusive. */
  price: number;
  quantity: number;
  /**
   * Whether a promo code may discount this line. The quiz code is scoped to
   * one collection, so only lines from that collection carry `true`. Absent
   * means `true` (an order-wide discount) so callers with no scoping concept
   * keep their meaning; the checkout paths always set it explicitly when a
   * code is in play.
   */
  eligible?: boolean;
}

export interface OrderTotals {
  subtotal: number;
  /** Rupees taken off by the promo code; 0 when no code is applied. */
  discountAmount: number;
  /** GST already contained in `total`, for the order record / invoice. */
  gstAmount: number;
  total: number;
  totalPaise: number;
}

/** Highest discount any code may apply. Above this a bug becomes a giveaway. */
export const MAX_DISCOUNT_PERCENT = 90;

/**
 * A usable discount percentage: a whole number in `[0, MAX_DISCOUNT_PERCENT]`.
 * Anything else reads as 0 — a discount is money, so an out-of-range value from
 * a caller must under-charge rather than over-charge. The routes only ever pass
 * a percent read back from `quiz_codes.percent`, whose CHECK constraint allows
 * 10/20/40; this is the second line, not the first.
 */
export function clampDiscountPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(Math.floor(percent), MAX_DISCOUNT_PERCENT);
}

/** GST rate for one piece at `unitPrice` (GST-inclusive, rupees). */
export function gstRateFor(unitPrice: number): number {
  return unitPrice <= GST_SLAB_THRESHOLD ? GST_RATE_LOW : GST_RATE_HIGH;
}

/** GST contained in a GST-inclusive `amount` charged at `rate`. */
export function gstFromInclusive(amount: number, rate: number): number {
  return Math.round(amount - amount / (1 + rate));
}

/**
 * Totals for priced cart lines. `total` is the amount to charge — the sum of
 * the GST-inclusive line prices less any promo discount, with shipping free at
 * every value. GST is computed per line (its own slab) and summed only for the
 * order record.
 *
 * The discount is a percentage of the *eligible* subtotal — the lines a promo
 * code may touch (see `PricedLine.eligible`) — rounded to whole rupees, so the
 * charged amount is always an integer and `totalPaise` is exact, and
 * `discountAmount + total === subtotal` whatever the cart's mix. GST is then
 * extracted from what is actually charged rather than from the pre-discount
 * subtotal: the invoice has to state the tax contained in the money received,
 * and an order that claimed tax on the undiscounted amount would overstate it.
 * Because the discount is a flat percentage of the eligible subset, every
 * eligible line scales by the same factor (so the discount spreads across them
 * in proportion to their totals and each keeps its own slab), while ineligible
 * lines are charged — and taxed — at exactly their list price.
 */
export function computeTotals(lines: PricedLine[], discountPercent = 0): OrderTotals {
  const percent = clampDiscountPercent(discountPercent);

  let subtotal = 0;
  let eligibleSubtotal = 0;
  for (const line of lines) {
    const lineTotal = line.price * line.quantity;
    subtotal += lineTotal;
    if (line.eligible !== false) eligibleSubtotal += lineTotal;
  }

  const discountAmount = percent > 0 ? Math.round((eligibleSubtotal * percent) / 100) : 0;
  const total = subtotal - discountAmount;

  // The factor the eligible lines are charged at: their share of the discount,
  // whole-rupee rounded once at the order level. Ineligible lines keep 1.
  const eligibleFactor =
    eligibleSubtotal > 0 ? (eligibleSubtotal - discountAmount) / eligibleSubtotal : 1;
  let gstAmount = 0;
  for (const line of lines) {
    const factor = line.eligible !== false ? eligibleFactor : 1;
    const lineTotal = line.price * line.quantity * factor;
    gstAmount += gstFromInclusive(lineTotal, gstRateFor(line.price));
  }

  return { subtotal, discountAmount, gstAmount, total, totalPaise: Math.round(total * 100) };
}
