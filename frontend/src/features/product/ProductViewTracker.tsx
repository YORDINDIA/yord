'use client';

import { useEffect } from 'react';
import { trackIfNew } from '@/lib/analytics/track';

/**
 * Fires the `product_viewed` behavioral event once per navigation to a
 * product page. Mounted by the product route; rendering nothing keeps it
 * invisible to layout.
 */
export function ProductViewTracker({ productId, handle }: { productId: number; handle: string }) {
  useEffect(() => {
    trackIfNew(`product:${productId}`, { type: 'product_viewed', productId, handle });
  }, [productId, handle]);

  return null;
}
