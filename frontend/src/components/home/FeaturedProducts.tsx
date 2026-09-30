import { getFeaturedProductsCached } from '@/lib/supabase/cached-queries';
import { ARTISTS } from '@yord/db-types';
import type { TransformedProductWithSource } from '@yord/db-types';
import { getFirstByPosition, getProductBadge } from '@/lib/product';
import { degrade } from '@/lib/result';
import { SectionRetry } from '@/components/ui/SectionRetry';
import { FeaturedProductsClient } from './FeaturedProductsClient';

export async function FeaturedProducts() {
  // Cached catalog read: prerenderable under `revalidate`, one cache tag.
  // A failed section degrades to an inline error + retry, never a blank page.
  const result = await degrade(getFeaturedProductsCached(8), [], 'home:featured', 'products');
  if (!result.ok) {
    return <SectionRetry title="Could not load featured products" />;
  }
  const products = result.value;

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
