import { getTopProductsCached } from '@/lib/supabase/cached-queries';
import { ARTISTS } from '@yord/db-types';
import type { TransformedProductWithSource } from '@yord/db-types';
import { getFirstByPosition, getProductBadge } from '@/lib/utils';
import { degrade } from '@/lib/result';
import { SectionRetry } from '@/components/ui/SectionRetry';
import { ArtistProductsSectionClient } from './ArtistProductsSectionClient';

interface ArtistProductsSectionProps {
  artistHandle: string;
  limit?: number;
}

export async function ArtistProductsSection({ artistHandle, limit = 4 }: ArtistProductsSectionProps) {
  // Cached catalog read: prerenderable under `revalidate`, tagged per artist.
  // A failed section degrades to an inline error + retry, never a blank page.
  const result = await degrade(
    getTopProductsCached(artistHandle, limit),
    [],
    `home:artist-${artistHandle}`,
    'products',
  );
  if (!result.ok) {
    return <SectionRetry title="Could not load this collection" />;
  }
  const products = result.value;

  // Get artist metadata
  const artistData = ARTISTS[artistHandle];

  if (!artistData || products.length === 0) {
    return null;
  }

  // Transform Supabase data for the client component
  const transformedProducts: TransformedProductWithSource[] = products.map((p) => {
    const variant = getFirstByPosition(p.product_variants);
    const image = getFirstByPosition(p.product_images);

    return {
      id: p.id.toString(),
      handle: p.handle,
      title: p.title,
      artist: p.vendor || artistData.name,
      price: variant?.price || 0,
      compareAtPrice: variant?.compare_at_price || null,
      image: image?.supabase_url || image?.src || null,
      badge: getProductBadge(p, variant),
      accentColor: artistData.accentColor || '#FFD966',
      originalProduct: p,
    };
  });

  return (
    <ArtistProductsSectionClient
      artistHandle={artistHandle}
      artistName={artistData.name}
      artistTagline={artistData.tagline}
      artistImage={artistData.heroImage}
      accentColor={artistData.accentColor || '#FFD966'}
      products={transformedProducts}
    />
  );
}
