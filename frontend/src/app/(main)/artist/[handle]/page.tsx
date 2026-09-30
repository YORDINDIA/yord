import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getArtistByHandle, getArtistsWithMetadata, getProductsByCollectionHandle } from '@/lib/supabase/queries';
import { parseSortParam, parsePageParam } from '@/lib/product';
import { ArtistHero } from '@/features/artist/ArtistHero';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { JsonLd, musicGroupSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface ArtistPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export const revalidate = 3600;

// Generate static paths for artists with products
export async function generateStaticParams() {
  // Use static client (no cookies) for build-time generation
  const artists = await getArtistsWithMetadata(true);
  return artists.map((artist) => ({
    handle: artist.handle,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { handle } = await params;
  // Use static client for metadata generation at build time
  const artist = await getArtistByHandle(handle, true);

  if (!artist) {
    return {
      title: 'Artist Not Found | YORD India',
    };
  }

  return {
    title: `${artist.name} Concert Merchandise India | YORD India`,
    description: `Shop exclusive ${artist.name} concert merchandise in India. ${artist.tagline}. Premium quality fan-made designs. Free shipping above ₹1,999.`,
    openGraph: {
      title: `${artist.name} Concert Merchandise | YORD India`,
      description: `Shop exclusive ${artist.name} concert merchandise. ${artist.tagline}.`,
      type: 'website',
    },
    alternates: { canonical: `/artist/${handle}` },
  };
}

export default async function ArtistPage({ params, searchParams }: ArtistPageProps) {
  const { handle } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;
  const sort = parseSortParam(rawSort);
  const page = parsePageParam(rawPage);
  const pageSize = 16;

  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const artist = await getArtistByHandle(handle, true);

  if (!artist) {
    notFound();
  }

  // Page 1 is SSR HTML (SEO); pages 2+ append via /api/products. The artist
  // two-hop skips the published gate, matching the old client fetch.
  const result = await getProductsByCollectionHandle(
    handle,
    { sort, page, pageSize },
    { publishedOnly: false, useStatic: true },
  );
  const products = result?.data ?? [];
  const count = result?.count ?? 0;

  return (
    <main>
      <JsonLd data={musicGroupSchema(artist)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Artists', url: '/artists' },
          { name: artist.name, url: `/artist/${handle}` },
        ])}
      />
      {/* Immersive Hero with Artist Branding */}
      <ArtistHero artist={artist} />

      {/* Products Grid */}
      <section
        className="py-24 bg-noir-950"
        style={{
          '--artist-accent': artist.accentColor,
          '--artist-secondary': artist.secondaryColor,
        } as React.CSSProperties}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={page}
            query={{ mode: 'artist', handle, sort, pageSize }}
            showSort
            showGridToggle
            toolbarClassName="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12"
            accentColor={artist.accentColor}
            toolbarLeft={
              <div>
                <p
                  className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] mb-3"
                  style={{ color: artist.accentColor }}
                >
                  {artist.name.toUpperCase()} COLLECTION
                </p>
                <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
                  Shop the Collection
                </h2>
              </div>
            }
            emptyTitle="No products found"
            emptyMessage={`Check back soon for new ${artist.name} merchandise.`}
          />
        </div>
      </section>
    </main>
  );
}
