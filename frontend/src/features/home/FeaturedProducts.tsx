import { getFeaturedProductsCached } from '@/lib/supabase/cached-queries';
import { degrade } from '@/lib/result';
import { SectionRetry } from '@/features/ui/SectionRetry';
import { toTransformedProducts } from './productTransform';
import { FeaturedProductsView } from './FeaturedProductsView';

export async function FeaturedProducts() {
  // Cached catalog read: prerenderable under `revalidate`, one cache tag.
  // A failed section degrades to an inline error + retry, never a blank page.
  const result = await degrade(getFeaturedProductsCached(8), [], 'home:featured', 'products');
  if (!result.ok) {
    return <SectionRetry title="Could not load featured products" />;
  }

  return <FeaturedProductsView products={toTransformedProducts(result.value)} />;
}
