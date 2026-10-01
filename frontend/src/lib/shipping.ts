// Single source of truth for shipping thresholds (INR).
// Used by CartDrawer, PDP trust badges, and SEO metadata copy.
// Matches the documented tiers on /shipping: standard free above ₹999,
// fast free above ₹1,999.
export const FREE_SHIPPING_THRESHOLD = 999;
export const FREE_FAST_SHIPPING_THRESHOLD = 1999;
