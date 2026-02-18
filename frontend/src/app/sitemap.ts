import type { MetadataRoute } from 'next';
import { createStaticClient } from '@/lib/supabase/server';
import { CONCERTS } from '@/lib/data/concerts';
import { CITIES } from '@/lib/data/cities';

const BASE_URL = 'https://yordindia.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/artists`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/concerts`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/size-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/concert-merchandise-india`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ];

  // Product pages
  const { data: products } = await supabase
    .from('products')
    .select('handle, updated_at')
    .eq('status', 'active') as { data: { handle: string; updated_at: string }[] | null };

  const productPages: MetadataRoute.Sitemap = (products || []).map((p) => ({
    url: `${BASE_URL}/product/${p.handle}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Collection pages
  const { data: collections } = await supabase
    .from('collections')
    .select('handle, updated_at')
    .eq('published', true) as { data: { handle: string | null; updated_at: string }[] | null };

  const collectionPages: MetadataRoute.Sitemap = (collections || [])
    .filter((c) => c.handle)
    .map((c) => ({
      url: `${BASE_URL}/collection/${c.handle}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  // Artist pages (from collections that are artist collections)
  const { data: artistCollections } = await supabase
    .from('collections')
    .select('handle, updated_at')
    .eq('published', true) as { data: { handle: string | null; updated_at: string }[] | null };

  const { ARTIST_COLLECTION_HANDLES } = await import('@/types/database');
  const artistHandleSet = new Set<string>(ARTIST_COLLECTION_HANDLES as unknown as string[]);

  const artistPages: MetadataRoute.Sitemap = (artistCollections || [])
    .filter((c) => c.handle && artistHandleSet.has(c.handle))
    .map((c) => ({
      url: `${BASE_URL}/artist/${c.handle}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  // Blog article pages
  const { data: articles } = await supabase
    .from('articles')
    .select('handle, updated_at')
    .eq('published', true) as { data: { handle: string | null; updated_at: string }[] | null };

  const articlePages: MetadataRoute.Sitemap = (articles || [])
    .filter((a) => a.handle)
    .map((a) => ({
      url: `${BASE_URL}/blog/${a.handle}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

  // Concert pages
  const concertPages: MetadataRoute.Sitemap = CONCERTS.map((c) => ({
    url: `${BASE_URL}/concerts/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // City concert pages
  const cityPages: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${BASE_URL}/concerts/city/${city.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...productPages,
    ...collectionPages,
    ...artistPages,
    ...articlePages,
    ...concertPages,
    ...cityPages,
  ];
}
