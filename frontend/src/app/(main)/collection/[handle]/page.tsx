import { Metadata } from 'next';
import { CollectionHeader } from '@/components/collection/CollectionHeader';
import { CollectionProducts } from '@/components/collection/CollectionProducts';
import { getCollectionsStatic, getCollectionByHandleStatic } from '@/lib/supabase/queries';
import { JsonLd, collectionPageSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface CollectionPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ sort?: string }>;
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
    ? collection.body_html.replace(/<[^>]*>/g, '').substring(0, 160)
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
  const { sort = 'newest' } = await searchParams;

  // Fetch collection metadata from database
  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const collection = await getCollectionByHandleStatic(handle);

  // Use DB title/description, or fallback to formatted handle
  const collectionTitle = collection?.title || handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const collectionDescription = collection?.body_html
    ? collection.body_html.replace(/<[^>]*>/g, '')
    : `Explore our ${collectionTitle} collection.`;

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
        productCount={0} // Will be updated by client component
      />

      {/* Collection Products */}
      <CollectionProducts
        handle={handle}
        initialSort={sort as 'newest' | 'price-asc' | 'price-desc' | 'title'}
      />
    </main>
  );
}
