import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { ArtistsPageClient } from '@/features/artist/ArtistsPageClient';

/** Prerendered hourly rather than rendered per request (Workers CPU budget). */
export const revalidate = 3600;

export const metadata = {
  title: 'Artists — Concert Merchandise for 65+ Artists',
  description: 'Browse concert merchandise for 65+ artists performing in India. Coldplay, Diljit Dosanjh, Karan Aujla, Ed Sheeran, Taylor Swift, AP Dhillon, Linkin Park & more.',
  alternates: { canonical: '/artists' },
};

export default async function ArtistsPage() {
  // Static (cookie-free) client: `createServerClient()` reads `cookies()`, a
  // dynamic API that would opt this route out of the prerender above.
  // `degrade: false` keeps a failed read throwing, so the error boundary shows
  // a retry instead of caching an empty roster for an hour.
  const artists = await getArtistsWithMetadata(true, { degrade: false });

  return <ArtistsPageClient artists={artists} />;
}
