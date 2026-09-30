import { Metadata } from 'next';
import { CollectionHeader } from '@/features/collection/CollectionHeader';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { getCollectionsStatic, getCollectionByHandleStatic, getProductsByCollectionHandle } from '@/lib/supabase/queries';
import { parseSortParam, parsePageParam } from '@/lib/product';
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

  const title = collection?.title || handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  // Strip HTML tags from body_html for description
  const description = collection?.body_html
    ? stripHtml(collection.body_html).substring(0, 160)
    : `Shop ${title} collection at YORD India. Premium concert merchandise.`;

  return {
    title: `${title} | YORD India`,
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
  const sort = parseSortParam(rawSort);
  const page = parsePageParam(rawPage);
  const pageSize = 12;

  // Fetch collection metadata from database
  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const collection = await getCollectionByHandleStatic(handle);

  // Use DB title/description, or fallback to formatted handle
  const collectionTitle = collection?.title || handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const collectionDescription = collection?.body_html
    ? stripHtml(collection.body_html)
    : `Explore our ${collectionTitle} collection.`;

  // Page 1 is SSR HTML (SEO); pages 2+ append via /api/products. Unknown
  // handle renders the header with an empty grid, as before.
  const result = await getProductsByCollectionHandle(
    handle,
    { sort, page, pageSize },
    { publishedOnly: true, useStatic: true },
  );
  const products = result?.data ?? [];
  const count = result?.count ?? 0;

  return (
    <main className="min-h-screen bg-noir-950 pt-20">
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
      </div>
    </main>
  );
}
