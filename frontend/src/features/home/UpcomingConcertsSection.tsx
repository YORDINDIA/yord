import { getUpcomingConcertsByArtist } from '@/lib/data/concerts';
import { getTopProductsByArtistHandle } from '@/lib/supabase/queries';
import { ARTISTS } from '@yord/db-types';
import { SectionRetry } from '@/features/ui/SectionRetry';
import { toTransformedProducts } from './productTransform';
import {
  UpcomingConcertsSectionView,
  type ConcertArtistData,
} from './UpcomingConcertsSectionView';

/**
 * Per-artist outcome. Distinguishing `failed` from `empty` is what lets the
 * section tell a broken backend (retry) from a catalog with nothing upcoming
 * (hide) — a failed read must never look like an empty result.
 */
type ArtistResult =
  | { status: 'ok'; artist: ConcertArtistData }
  | { status: 'failed' }
  | { status: 'empty' };

export async function UpcomingConcertsSection() {
  // Capture timestamp early - safe in server component
  // eslint-disable-next-line react-hooks/purity
  const currentTimestamp = Date.now();
  const upcomingByArtist = getUpcomingConcertsByArtist();

  if (upcomingByArtist.length === 0) return null;

  const results = await Promise.all(
    upcomingByArtist.map(async ({ artistHandle, tourName, nextShow, allUpcoming }): Promise<ArtistResult> => {
      const artistData = ARTISTS[artistHandle];
      if (!artistData) return { status: 'empty' };

      // One failing artist must not blank the whole section: skip it.
      let products;
      try {
        products = await getTopProductsByArtistHandle(artistHandle, 4, true);
      } catch {
        return { status: 'failed' };
      }
      if (products.length === 0) return { status: 'empty' };

      return {
        status: 'ok',
        artist: {
          artistHandle,
          artistName: artistData.name,
          artistImage: artistData.heroImage,
          accentColor: artistData.accentColor || 'var(--accent)',
          secondaryColor: artistData.secondaryColor || '#1C1C1C',
          tourName,
          nextShowDate: nextShow.date,
          nextShowCity: nextShow.city,
          nextShowVenue: nextShow.venue,
          totalUpcomingShows: allUpcoming.length,
          products: toTransformedProducts(products, {
            accentColor: artistData.accentColor || 'var(--accent)',
            fallbackArtist: artistData.name,
          }),
        },
      };
    })
  );

  const concertArtists = results.flatMap((result) =>
    result.status === 'ok' ? [result.artist] : [],
  );

  if (concertArtists.length === 0) {
    const failedReads = results.filter((result) => result.status === 'failed').length;
    return failedReads > 0 ? <SectionRetry title="Could not load upcoming concerts" /> : null;
  }

  return (
    <UpcomingConcertsSectionView
      concertArtists={concertArtists}
      currentTimestamp={currentTimestamp}
    />
  );
}
