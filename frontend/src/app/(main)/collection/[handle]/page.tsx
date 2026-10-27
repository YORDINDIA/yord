import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { CatalogLayout } from '@/features/catalog/CatalogLayout';
import { CatalogFilterProvider } from '@/features/catalog/CatalogFilterContext';
import type { ProductsQuery } from '@/hooks/useProductsInfinite';
import {
  getCollectionsStatic,
  getCollectionByHandleStatic,
  getProductsByCollectionHandle,
  getProductTypes,
  getArtistsWithMetadata,
} from '@/lib/supabase/queries';
import { getCatalogSizesCached } from '@/lib/supabase/cached-queries';
import { isAutoCollection } from '@/lib/data/autoCollections';
import { degrade } from '@/lib/result';
import { resolveSort } from '@/lib/product';
import { stripHtml } from '@yord/ui';
import { JsonLd, collectionPageSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface CollectionPageProps {
  params: Promise<{ handle: string }>;
}

/**
 * Prerendered once an hour, served from the R2 incremental cache after that.
 *
 * `searchParams` used to be awaited here and in `generateMetadata` to read
 * `?sort=`, `?page=` and the facet set. That is a dynamic API in Next: it opted
 * the route out of static rendering, so `revalidate = 3600` did nothing and
 * every request ran the Supabase reads plus a full render. Facets and sort now
 * live in `CatalogFilterProvider` and page through `GET /api/products`;
 * `collection.sort_order` still decides the default order, resolved here.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const collections = await getCollectionsStatic();
  return collections
    .filter((collection) => collection.handle)
    .map((collection) => ({
      handle: collection.handle as string,
    }));
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollectionByHandleStatic(handle);

  // No published row → the page below calls `notFound()`, so do not invent a
  // title from the slug: a 404 must not advertise itself as a real page (and
  // the fabricated "Handle Name" title is what the tab and SERP snippet show).
  if (!collection) {
    return { title: 'Collection Not Found' };
  }

  // `title` is a bare string: the root layout's `template: '%s | YORD India'`
  // appends the brand, so adding it here produced
  // "All | YORD India | YORD India" in <title>. `openGraph.title` is NOT
  // templated, so it keeps the explicit suffix.
  const title = collection.title;
  const description = collection.body_html
    ? stripHtml(collection.body_html).substring(0, 160)
    : `Shop ${title} collection at YORD India. Premium concert merchandise.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | YORD India`,
      description,
      type: 'website',
    },
    alternates: { canonical: `/collection/${handle}` },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { handle } = await params;
  const pageSize = 24;
  // Filters apply to the computed collections only: a curated list pages its
  // stored ids first, so filtering it needs that paging reworked.
  const filterable = isAutoCollection(handle);

  // Fetch collection metadata from database
  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const collection = await getCollectionByHandleStatic(handle);

  // The effective order is the collection's own `sort_order` unless the shopper
  // passes `?sort=`. The shopper's choice is layered on client-side; this is
  // the default the prerender carries. It has to be resolved HERE, on the
  // server, because the same value is handed to `CatalogGrid` as its query —
  // pages 2+ come from `GET /api/products`, so a grid seeded with `newest`
  // while SSR rendered `price-asc` would append a differently-ordered page.
  const sort = resolveSort(undefined, collection?.sort_order);

  // Use DB title/description, or fallback to formatted handle
  const collectionTitle = collection?.title || handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const collectionDescription = collection?.body_html
    ? stripHtml(collection.body_html)
    : `Explore our ${collectionTitle} collection.`;

  // Page 1 is SSR HTML (SEO); pages 2+ append via /api/products.
  // getProductsByCollectionHandle returns null only when no published
  // collection matches the handle, so a null result is an unknown handle and
  // renders the route's not-found page. A known-but-empty collection returns
  // { data: [], count: 0 } and still renders the grid below.
  const result = await getProductsByCollectionHandle(
    handle,
    { sort, page: 1, pageSize, filters: {} },
    { publishedOnly: true, useStatic: true },
  );
  if (!result) notFound();
  const products = result.data;
  const count = result.count;

  // Facet lists are optional: on a failed read the panel drops that facet.
  const [types, artists, sizes] = filterable
    ? await Promise.all([
        degrade(getProductTypes(true), [] as string[], 'collection:types', 'products'),
        degrade(getArtistsWithMetadata(true), [], 'collection:artists', 'collections'),
        degrade(getCatalogSizesCached(), [] as string[], 'collection:sizes', 'products'),
      ])
    : [];

  const baseQuery: ProductsQuery = {
    mode: 'collection',
    handle,
    sort,
    pageSize,
  };

  return (
    <div>
      <JsonLd
        data={collectionPageSchema({
          title: collectionTitle,
          handle,
          description: collectionDescription,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Collections', url: '/collections' },
          { name: collectionTitle, url: `/collection/${handle}` },
        ])}
      />
      <CatalogFilterProvider path={`/collection/${handle}`} baseQuery={baseQuery} initialCount={count}>
        <CatalogLayout
          title={collectionTitle}
          count={count}
          description={collectionDescription}
          before={
            <nav aria-label="Breadcrumb" className="mb-4 font-body text-sm text-text-muted">
              <Link href="/collections" className="hover:text-accent">Collections</Link>
            </nav>
          }
          facets={
            filterable
              ? {
                  types: types?.ok ? types.value : [],
                  artists: artists?.ok ? artists.value : [],
                  sizes: sizes?.ok ? sizes.value : [],
                }
              : undefined
          }
        >
          {/* The grid owns the empty and page-overflow states, so a deep
              `?page=` cannot contradict the header count. */}
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={1}
            query={baseQuery}
            showSort={!filterable}
            emptyTitle="No products found"
            emptyMessage="Check back soon for new arrivals in this collection."
            pageOneHref={`/collection/${handle}`}
          />
        </CatalogLayout>
      </CatalogFilterProvider>
    </div>
  );
}
