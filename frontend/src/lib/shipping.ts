// Single source of truth for the shipping promise (INR).
//
// Shipping is free on every order, at every value: both checkout routes charge
// `subtotal + GST`, the order row is written with `total_shipping_price: 0`,
// and /shipping documents no fee. The threshold below gates *speed*, not price
// — orders at or above it ship FREE Fast, everything else FREE Standard — so
// nothing in this module ever produces an amount owed.
export const FREE_FAST_SHIPPING_THRESHOLD = 2000;

/** The shipping line, always free: `FREE Fast` / `FREE Standard`. */
export function shippingLabel(subtotal: number): 'FREE Fast' | 'FREE Standard' {
  return subtotal >= FREE_FAST_SHIPPING_THRESHOLD ? 'FREE Fast' : 'FREE Standard';
}
