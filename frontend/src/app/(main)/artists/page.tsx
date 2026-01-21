import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { ArtistsPageClient } from './ArtistsPageClient';

export const metadata = {
  title: 'Featured Artists | YORD India',
  description: 'Explore exclusive concert merchandise from the world\'s most iconic artists.',
};

export default async function ArtistsPage() {
  const artists = await getArtistsWithMetadata();

  return <ArtistsPageClient artists={artists} />;
}
