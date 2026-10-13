import Link from 'next/link';
import Image from 'next/image';
import { getCollections } from '@/lib/supabase/queries';
import { isGridListedCollection } from '@/lib/data/autoCollections';
import { firstDisplayableImageUrl } from '@/lib/media';
import { Container } from '@/features/ui/Container';
import { EmptyState } from '@/features/ui/EmptyState';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { stripHtml } from '@yord/ui';
import { Layers } from 'lucide-react';

export const metadata = {
  title: 'Collections',
  description: 'Browse our curated collections of official artist merchandise.',
  alternates: { canonical: '/collections' },
};

export default async function CollectionsPage() {
  const published = await getCollections();
  // Owner decision: the computed handles in `AUTO_COLLECTION_HANDLES`
  // (`new-arrivals`, `all`) get no grid card — they stay reachable by URL,
  // sitemap and nav. The query helper stays unfiltered for its other callers.
  const collections = published.filter((c) => isGridListedCollection(c.handle));

  return (
    <div className="min-h-screen bg-surface-page">
      <Container className="pt-24 pb-16">
        {/* Header */}
        <div className="mb-12 flex flex-col items-center">
          <div className="w-16 h-16 mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Layers aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <SectionHeading
            as="h1"
            align="center"
            title="Collections"
            description="Explore our curated collections featuring the best in concert fashion and artist merchandise."
          />
        </div>

        {/* Collections Grid */}
        {collections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((collection) => {
              // `image_src` is a dead legacy Shopify URL on most collections, so
              // render the first URL that can actually load — otherwise the
              // cover falls through to the gradient placeholder instead.
              const cover = firstDisplayableImageUrl(collection.storage_image_url, collection.image_src);
              return (
                <Link
                  key={collection.id}
                  href={`/collection/${collection.handle}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-surface-card">
                    {cover ? (
                      <Image
                        src={cover}
                        alt={collection.image_alt || collection.title}
                        fill
                        // The grid is 3 columns at lg; the default `100vw`
                        // fetched a full-width file for a third-width tile.
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-surface-card">
                        <Layers aria-hidden="true" className="w-16 h-16 text-text-muted" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {/* On-media tones: this caption sits on the from-scrim/80
                          wash over the image, so it must not follow the theme or it
                          becomes near-black on a near-black scrim. */}
                      <h2 className="font-display text-2xl text-text-on-media mb-2 group-hover:text-accent-on-media transition-colors">
                        {collection.title}
                      </h2>
                      {collection.body_html && (
                        <p className="font-body text-sm text-text-on-media-muted line-clamp-2">
                          {stripHtml(collection.body_html).slice(0, 100) + '...'}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No collections yet"
            message="Collections appear here as soon as they are published."
          />
        )}
      </Container>
    </div>
  );
}
