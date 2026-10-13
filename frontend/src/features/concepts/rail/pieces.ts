import { mediaLoader } from '@/lib/media-loader';
import { sortByPosition } from '@/lib/product';
import { maxQuantityFor } from '@/features/product/cartItem';
import type { ConceptProduct } from '../loaders';

/** Same-origin prefix that `next.config.ts` rewrites to the media bucket. */
export const RAIL_MEDIA_PREFIX = '/rail-media';

/** Bucket origin behind the rewrite: the custom media domain, else r2.dev. */
export function railMediaOrigin(): string | undefined {
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.R2_PUBLIC_BASE_URL)?.trim();
  return base ? base.replace(/\/+$/, '') : undefined;
}

export interface RailSize {
  variantId: number;
  label: string;
  available: boolean;
  price: number;
  compareAtPrice: number | null;
  maxQuantity: number;
  variantTitle: string | null;
}

/** One garment on the rail. Only what the client needs, never the raw row. */
export interface RailPiece {
  key: string;
  productId: number | null;
  handle: string;
  title: string;
  artist: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  /** Same-origin texture URL for WebGL, or null when no CORS-safe path exists. */
  texture: string | null;
  optionName: string;
  sizes: RailSize[];
}

/* WebGL can only sample a cross-origin image that sends CORS headers, and the
   bucket sends none. Local files are already same-origin; bucket files go
   through the `/rail-media/products` rewrite. Anything else gets plain fabric. */
function textureUrl(src: string | null): string | null {
  if (!src) return null;
  if (src.startsWith('/')) return src;
  const origin = railMediaOrigin();
  if (!origin) return null;
  const sized = mediaLoader({ src, width: 640 });
  return sized.startsWith(`${origin}/products/`) ? RAIL_MEDIA_PREFIX + sized.slice(origin.length) : null;
}

export function toPieces(products: ConceptProduct[]): RailPiece[] {
  return products.map((p) => {
    const row = p.originalProduct;
    const variants = row ? sortByPosition(row.product_variants) : [];
    // When the first option repeats (XS in two colours), name the whole variant.
    const firsts = variants.map((v) => v.option1);
    const repeats = new Set(firsts).size < firsts.length;
    const sizes: RailSize[] = row
      ? variants.map((v) => ({
          variantId: v.id,
          label: (repeats ? v.title : v.option1) || v.title || 'One size',
          available: v.inventory_quantity > 0,
          price: v.price,
          compareAtPrice: v.compare_at_price,
          maxQuantity: maxQuantityFor(v.inventory_quantity),
          variantTitle: v.title,
        }))
      : [];
    return {
      key: p.id,
      productId: row?.id ?? null,
      handle: p.handle,
      title: p.title,
      artist: p.artist,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.image,
      texture: textureUrl(p.image),
      optionName: row?.product_options?.[0]?.name || 'Size',
      sizes,
    };
  });
}
