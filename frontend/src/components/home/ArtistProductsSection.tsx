import { getTopProductsByArtistHandle } from '@/lib/supabase/queries';
import { ARTISTS } from '@/types/database';
import type { TransformedProductWithSource } from '@/types/database';
import { getFirstByPosition, getProductBadge } from '@/lib/utils';
import { ArtistProductsSectionClient } from './ArtistProductsSectionClient';

interface ArtistProductsSectionProps {
  artistHandle: string;
  limit?: number;
}

export async function ArtistProductsSection({ artistHandle, limit = 4 }: ArtistProductsSectionProps) {
  const products = await getTopProductsByArtistHandle(artistHandle, limit);

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
      accentColor={artistData.accentColor || '#FFD966'}
      products={transformedProducts}
    />
  );
}
