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
}

export interface OrderTotals {
  subtotal: number;
  /** GST already contained in `total`, for the order record / invoice. */
  gstAmount: number;
  total: number;
  totalPaise: number;
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
 * the GST-inclusive line prices, with shipping free at every value. GST is
 * computed per line (its own slab) and summed only for the order record.
 */
export function computeTotals(lines: PricedLine[]): OrderTotals {
  let subtotal = 0;
  let gstAmount = 0;
  for (const line of lines) {
    const lineTotal = line.price * line.quantity;
    subtotal += lineTotal;
    gstAmount += gstFromInclusive(lineTotal, gstRateFor(line.price));
  }
  const total = subtotal;
  return { subtotal, gstAmount, total, totalPaise: Math.round(total * 100) };
}
