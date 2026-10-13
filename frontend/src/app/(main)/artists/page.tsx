import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { ArtistsPageClient } from '@/features/artist/ArtistsPageClient';

export const metadata = {
  title: 'Artists — Concert Merchandise for 65+ Artists',
  description: 'Browse concert merchandise for 65+ artists performing in India. Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, Taylor Swift, AP Dhillon, Linkin Park & more.',
  alternates: { canonical: '/artists' },
};

export default async function ArtistsPage() {
  const artists = await getArtistsWithMetadata();

  return <ArtistsPageClient artists={artists} />;
}
