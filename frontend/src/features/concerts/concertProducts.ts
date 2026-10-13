import type { ProductWithDetails, TransformedProductWithSource } from '@yord/db-types';
import type { ConcertProductsMap } from '@/lib/supabase/queries';
import { getFirstByPosition, getProductBadge } from '@/lib/product';

/**
 * Handles from a `ConcertProductsMap` that have at least one live product.
 * List cards no longer render products, but the merch CTA still needs this
 * gate: `/artist/[handle]` 404s when the artist has no collection row.
 */
export function merchArtistsFromMap(map: ConcertProductsMap): Set<string> {
  return new Set(
    Object.entries(map)
      .filter(([, rows]) => rows.length > 0)
      .map(([handle]) => handle)
  );
}

/** Shape raw Supabase rows into card-ready products for concert surfaces. */
export function toConcertCardProducts(
  rows: ProductWithDetails[],
  accentColor: string,
  fallbackArtist: string
): TransformedProductWithSource[] {
  return rows
    .filter((p) => p.handle)
    .map((p) => {
      const variant = getFirstByPosition(p.product_variants);
      const image = getFirstByPosition(p.product_images);
      return {
        id: p.id.toString(),
        handle: p.handle ?? '',
        title: p.title,
        artist: p.vendor || fallbackArtist,
        price: variant?.price || 0,
        compareAtPrice: variant?.compare_at_price || null,
        image: image?.storage_url || image?.src || null,
        badge: getProductBadge(p, variant),
        accentColor,
        originalProduct: p,
      };
    });
}
