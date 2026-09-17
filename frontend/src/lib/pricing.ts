// Server-side money math. Both checkout routes recompute totals from DB
// variant prices so client-supplied amounts are display-only.
export const GST_RATE = 0.18;
export const MAX_ORDER_LINES = 50;
export const MAX_QTY_PER_LINE = 10;

export function computeTotals(subtotal: number): { gstAmount: number; total: number; totalPaise: number } {
  const gstAmount = Math.round(subtotal * GST_RATE);
  const total = subtotal + gstAmount;
  return { gstAmount, total, totalPaise: Math.round(total * 100) };
}
