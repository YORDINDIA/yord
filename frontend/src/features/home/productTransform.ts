import { ARTISTS } from '@yord/db-types';
import type { ProductWithDetails, TransformedProductWithSource } from '@yord/db-types';
import { getFirstByPosition, getProductBadge } from '@/lib/product';

interface TransformOptions {
  /**
   * Fixed accent for the whole rail (an artist section tints every card with
   * that artist's colour). Omit to resolve the colour per product from the
   * static artist record — which is what the featured grid needs, since its
   * cards come from several artists.
   */
  accentColor?: string;
  /** Display artist for products with no vendor. */
  fallbackArtist?: string;
}

/**
 * The `ProductWithDetails` → `TransformedProductWithSource` mapping every home
 * rail needs. Three copies of it had drifted: only the featured section
 * filtered null handles, and a null handle renders a card linking to
 * `/product/`. One copy, one rule.
 */
export function toTransformedProducts(
  products: ProductWithDetails[],
  { accentColor, fallbackArtist = 'YORD' }: TransformOptions = {},
): TransformedProductWithSource[] {
  return products
    // A null handle would render a ProductCard linking to /product/.
    .filter((p) => p.handle)
    .map((p) => {
      const variant = getFirstByPosition(p.product_variants);
      const image = getFirstByPosition(p.product_images);
      const artistHandle = p.vendor?.toLowerCase().replace(/\s+/g, '-') || '';

      return {
        id: p.id.toString(),
        handle: p.handle ?? '',
        title: p.title,
        artist: p.vendor || fallbackArtist,
        price: variant?.price || 0,
        compareAtPrice: variant?.compare_at_price || null,
        image: image?.storage_url || image?.src || null,
        badge: getProductBadge(p, variant),
        accentColor: accentColor ?? ARTISTS[artistHandle]?.accentColor ?? 'var(--accent)',
        originalProduct: p,
      };
    });
}
