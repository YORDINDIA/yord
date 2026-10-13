import { getSupabaseClient } from '@/lib/supabase/client';
import { ARTISTS, ARTIST_COLLECTION_HANDLES } from '@yord/db-types';

export interface QuickSearch {
  label: string;
  type: 'artist' | 'category';
  accentColor?: string;
}

/**
 * Artist collections with product counts plus fallback categories, as shown
 * under "Popular Searches".
 *
 * Two PostgREST queries, cached at module scope: the modal used to hold the
 * promise in a ref, and because it unmounted on close the ref died with it — so
 * every open refired both queries. A failed load is dropped from the cache so
 * the next open retries.
 */
let request: Promise<QuickSearch[]> | null = null;

export function getPopularSearches(): Promise<QuickSearch[]> {
  request ??= fetchPopularSearches().catch((error) => {
    request = null;
    throw error;
  });
  return request;
}

async function fetchPopularSearches(): Promise<QuickSearch[]> {
  const supabase = getSupabaseClient();
  // Get artist collections that have products
  const { data: collections } = await supabase
    .from('collections')
    .select('id, title, handle')
    .in('handle', ARTIST_COLLECTION_HANDLES as unknown as string[]);

  if (!collections) return [];

  // Single query for all counts (not one per collection)
  const ids = (collections as { id: number }[]).map((c) => c.id);
  const { data: allCollects } = await supabase
    .from('collects')
    .select('collection_id')
    .in('collection_id', ids);
  const counts = new Map<number, number>();
  for (const row of (allCollects as { collection_id: number }[] | null) || []) {
    counts.set(row.collection_id, (counts.get(row.collection_id) || 0) + 1);
  }

  const artistsWithCounts = (
    collections as { id: number; title: string; handle: string | null }[]
  ).map((col) => ({
    ...col,
    productCount: counts.get(col.id) || 0,
  }));

  // Filter to artists with products and take top 4
  const topArtists = artistsWithCounts
    .filter((a) => a.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 4);

  // Build quick searches: artists with metadata + fallback categories
  const artistSearches: QuickSearch[] = topArtists.map((col) => {
    const handle = col.handle || '';
    const metadata = ARTISTS[handle];
    return {
      label: col.title,
      type: 'artist' as const,
      accentColor: metadata?.accentColor,
    };
  });

  const categorySearches: QuickSearch[] = [
    { label: 'T-Shirts', type: 'category' },
    { label: 'Hoodies', type: 'category' },
  ];

  return [...artistSearches, ...categorySearches];
}
