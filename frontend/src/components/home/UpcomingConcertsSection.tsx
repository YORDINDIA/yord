import { getUpcomingConcertsByArtist } from '@/lib/data/concerts';
import { getTopProductsByArtistHandle } from '@/lib/supabase/queries';
import { ARTISTS } from '@/types/database';
import type { TransformedProductWithSource } from '@/types/database';
import { getFirstByPosition, getProductBadge } from '@/lib/utils';
import { UpcomingConcertsSectionClient, type ConcertArtistData } from './UpcomingConcertsSectionClient';

export async function UpcomingConcertsSection() {
  // Capture timestamp early - safe in server component
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();
  const upcomingByArtist = getUpcomingConcertsByArtist();

  if (upcomingByArtist.length === 0) return null;

  const concertArtists = (
    await Promise.all(
      upcomingByArtist.map(async ({ artistHandle, tourName, nextShow, allUpcoming }) => {
        const artistData = ARTISTS[artistHandle];
        if (!artistData) return null;

        const products = await getTopProductsByArtistHandle(artistHandle, 4);
        if (products.length === 0) return null;

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

        return {
          artistHandle,
          artistName: artistData.name,
          artistImage: artistData.heroImage,
          accentColor: artistData.accentColor || '#FFD966',
          secondaryColor: artistData.secondaryColor || '#1C1C1C',
          tourName,
          nextShowDate: nextShow.date,
          nextShowCity: nextShow.city,
          nextShowVenue: nextShow.venue,
          totalUpcomingShows: allUpcoming.length,
          products: transformedProducts,
        } satisfies ConcertArtistData;
      })
    )
  ).filter(Boolean) as ConcertArtistData[];

  if (concertArtists.length === 0) return null;

  // Pass initial server timestamp to ensure consistent hydration
  return (
    <UpcomingConcertsSectionClient
      concertArtists={concertArtists}
      initialTimestamp={initialTimestamp}
    />
  );
}
