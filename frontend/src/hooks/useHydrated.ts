'use client';

import { useCartStore } from '@/lib/stores/cartStore';
import { useWishlistStore } from '@/lib/stores/wishlistStore';

/**
 * True once the persisted store has rehydrated from localStorage. Gate
 * persisted reads (badge counts, wishlist/cart contents) on these so the
 * first paint never flashes a wrong empty state that pops in a beat later.
 */
export function useCartHydrated(): boolean {
  return useCartStore((state) => state._hasHydrated);
}

export function useWishlistHydrated(): boolean {
  return useWishlistStore((state) => state._hasHydrated);
}
