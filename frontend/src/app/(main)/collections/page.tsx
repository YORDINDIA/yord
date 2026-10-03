import Link from 'next/link';
import Image from 'next/image';
import { getCollections } from '@/lib/supabase/queries';
import { isGridListedCollection } from '@/lib/data/autoCollections';
import { firstDisplayableImageUrl } from '@/lib/media';
import { stripHtml } from '@yord/ui';
import { Layers } from 'lucide-react';

export const metadata = {
  title: 'Collections',
  description: 'Browse our curated collections of official artist merchandise.',
};

export default async function CollectionsPage() {
  const published = await getCollections();
  // Owner decision: the computed handles in `AUTO_COLLECTION_HANDLES`
  // (`new-arrivals`, `all`) get no grid card — they stay reachable by URL,
  // sitemap and nav. The query helper stays unfiltered for its other callers.
  const collections = published.filter((c) => isGridListedCollection(c.handle));

  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Layers className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            Collections
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-2xl mx-auto">
            Explore our curated collections featuring the best in concert fashion and artist merchandise.
          </p>
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
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-surface-card">
                        <Layers className="w-16 h-16 text-text-muted" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      {/* On-media tones: this caption sits on the from-scrim/80
                          wash over the image, so it must not follow the theme or it
                          becomes near-black on a near-black scrim. */}
                      <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-on-media mb-2 group-hover:text-accent-on-media transition-colors">
                        {collection.title}
                      </h2>
                      {collection.body_html && (
                        <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-on-media-muted line-clamp-2">
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
          <div className="text-center py-16">
            <Layers className="w-16 h-16 mx-auto text-text-muted mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted">
              No collections available at the moment.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
