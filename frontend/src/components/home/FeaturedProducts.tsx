import { getFeaturedProductsCached } from '@/lib/supabase/cached-queries';
import { ARTISTS } from '@/types/database';
import type { TransformedProductWithSource } from '@/types/database';
import { getFirstByPosition, getProductBadge } from '@/lib/utils';
import { FeaturedProductsClient } from './FeaturedProductsClient';

export async function FeaturedProducts() {
  // Cached catalog read: prerenderable under `revalidate`, one cache tag
  const products = await getFeaturedProductsCached(8);

  // Transform Supabase data for the component
  const transformedProducts: TransformedProductWithSource[] = products.map((p) => {
    const variant = getFirstByPosition(p.product_variants);
    const image = getFirstByPosition(p.product_images);

    // Determine artist accent color
    const artistHandle = p.vendor?.toLowerCase().replace(/\s+/g, '-') || '';
    const artistData = ARTISTS[artistHandle];
    const accentColor = artistData?.accentColor || '#FFD966';

    return {
      id: p.id.toString(),
      handle: p.handle,
      title: p.title,
      artist: p.vendor || 'YORD',
      price: variant?.price || 0,
      compareAtPrice: variant?.compare_at_price || null,
      image: image?.supabase_url || image?.src || null,
      badge: getProductBadge(p, variant),
      accentColor,
      originalProduct: p,
    };
  });

  return <FeaturedProductsClient products={transformedProducts} />;
}
