import { unstable_cache } from 'next/cache';
import {
  getFeaturedProducts as getFeaturedUncached,
  getTopProductsByArtistHandle as getTopProductsUncached,
  getConcertProductsByHandles as getConcertProductsUncached,
} from './queries';

export const CATALOG_REVALIDATE_SECONDS = 3600;

export const CACHE_TAGS = {
  products: 'catalog:products',
  collections: 'catalog:collections',
  artists: 'catalog:artists',
} as const;

export const getFeaturedProductsCached = (limit = 8) =>
  unstable_cache(() => getFeaturedUncached(limit, true), ['featured-products', String(limit)], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.products],
  })();

export const getTopProductsCached = (artistHandle: string, limit = 4) =>
  unstable_cache(
    () => getTopProductsUncached(artistHandle, limit, true),
    ['top-products', artistHandle, String(limit)],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.products, `${CACHE_TAGS.artists}:${artistHandle}`],
    }
  )();

/** Batched newest-products-per-artist for concert surfaces (1h cache). */
export const getConcertProductsCached = (handles: string[], limitPerArtist = 3) => {
  const sorted = [...new Set(handles)].sort();
  return unstable_cache(
    () => getConcertProductsUncached(sorted, limitPerArtist, true),
    ['concert-products', sorted.join(','), String(limitPerArtist)],
    {
      revalidate: CATALOG_REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.products, CACHE_TAGS.artists],
    }
  )();
};
