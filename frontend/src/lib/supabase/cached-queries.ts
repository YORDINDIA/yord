import { unstable_cache } from 'next/cache';
import {
  getFeaturedProducts as getFeaturedUncached,
  getCollectionsStatic as getCollectionsUncached,
  getArtistsWithMetadata as getArtistsUncached,
  getTopProductsByArtistHandle as getTopProductsUncached,
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

export const getCollectionsCached = () =>
  unstable_cache(() => getCollectionsUncached(), ['collections'], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.collections],
  })();

export const getArtistsCached = () =>
  unstable_cache(() => getArtistsUncached(true), ['artists'], {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.artists, CACHE_TAGS.collections],
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
