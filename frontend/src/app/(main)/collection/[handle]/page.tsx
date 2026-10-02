import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionHeader } from '@/features/collection/CollectionHeader';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { getCollectionsStatic, getCollectionByHandleStatic, getProductsByCollectionHandle } from '@/lib/supabase/queries';
import { parsePageParam, resolveSort } from '@/lib/product';
import { stripHtml } from '@yord/ui';
import { JsonLd, collectionPageSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface CollectionPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

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
  };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { handle } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;
  const page = parsePageParam(rawPage);
  const pageSize = 12;

  // Fetch collection metadata from database
  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const collection = await getCollectionByHandleStatic(handle);

  // The effective order is the collection's own `sort_order` unless the shopper
  // passed `?sort=`. It has to be resolved HERE, on the server, because the
  // same value is handed to `CatalogGrid` as its query — pages 2+ come from
  // `GET /api/products`, so a grid seeded with `newest` while SSR rendered
  // `price-asc` would append a differently-ordered second page.
  const sort = resolveSort(rawSort, collection?.sort_order);

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
    { sort, page, pageSize },
    { publishedOnly: true, useStatic: true },
  );
  if (!result) notFound();
  const products = result.data;
  const count = result.count;

  // A `?page=` past the end (a stale bookmark after the collection shrank, or a
  // hand-typed page number) must not read as an empty collection: the header
  // above still shows the real total, so "No products found" would be a lie.
  // Render an out-of-range state with a way back instead of the grid's empty
  // copy, which is written for a genuinely empty collection.
  const pagePastEnd = page > 1 && products.length === 0 && count > 0;

  return (
    <main className="min-h-screen bg-surface-page pt-20">
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
      {/* Collection Header */}
      <CollectionHeader
        title={collectionTitle}
        description={collectionDescription}
        handle={handle}
        productCount={count}
      />

      {/* Collection Products */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        {pagePastEnd ? (
          <div className="py-24 text-center">
            <p className="text-lg text-text-secondary mb-2">Nothing on page {page}</p>
            <p className="text-text-muted mb-6">
              This collection has {count} products. Head back to the first page to browse them.
            </p>
            <Link
              href={`/collection/${handle}`}
              className="inline-block bg-accent text-text-on-accent px-6 py-3 text-sm tracking-wide uppercase hover:opacity-90 transition-opacity"
            >
              Back to page 1
            </Link>
          </div>
        ) : (
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={page}
            query={{ mode: 'collection', handle, sort, pageSize }}
            showSort
            showGridToggle
            emptyTitle="No products found"
            emptyMessage="Check back soon for new arrivals in this collection."
          />
        )}
      </div>
    </main>
  );
}
