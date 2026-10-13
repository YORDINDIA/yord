import { getTopProductsCached } from '@/lib/supabase/cached-queries';
import { ARTISTS } from '@yord/db-types';
import { degrade } from '@/lib/result';
import { SectionRetry } from '@/features/ui/SectionRetry';
import { toTransformedProducts } from './productTransform';
import { ArtistProductsSectionView } from './ArtistProductsSectionView';

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

  // Get artist metadata
  const artistData = ARTISTS[artistHandle];

  if (!artistData || result.value.length === 0) {
    return null;
  }

  const accentColor = artistData.accentColor || 'var(--accent)';

  return (
    <ArtistProductsSectionView
      artistHandle={artistHandle}
      artistName={artistData.name}
      artistTagline={artistData.tagline}
      artistImage={artistData.heroImage}
      accentColor={accentColor}
      products={toTransformedProducts(result.value, {
        accentColor,
        fallbackArtist: artistData.name,
      })}
    />
  );
}
