import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getArtistByHandle, getArtistsWithMetadata, getProductsByCollectionHandle } from '@/lib/supabase/queries';
import { ArtistHero } from '@/features/artist/ArtistHero';
import { CatalogGrid } from '@/features/catalog/CatalogGrid';
import { Container } from '@/features/ui/Container';
import Link from 'next/link';
import { buildFilterUrl } from '@/features/catalog/catalogUrl';
import { ArrowDiag } from '@/features/ui/Glyphs';
import { JsonLd, musicGroupSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface ArtistPageProps {
  params: Promise<{ handle: string }>;
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
      title: 'Artist Not Found',
    };
  }

  return {
    title: `${artist.name} Concert Merchandise India`,
    description: `Shop exclusive ${artist.name} concert merchandise in India. ${artist.tagline}. Premium quality fan-made designs. Free shipping on every order.`,
    openGraph: {
      title: `${artist.name} Concert Merchandise | YORD India`,
      description: `Shop exclusive ${artist.name} concert merchandise. ${artist.tagline}.`,
      type: 'website',
    },
    alternates: { canonical: `/artist/${handle}` },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { handle } = await params;
  // No `searchParams` here on purpose: awaiting it opts the whole route
  // into dynamic rendering and every request reruns the Supabase reads,
  // bypassing `revalidate = 3600`. The page prerenders with the default
  // order (newest, page 1); sort changes refetch client-side via
  // `CatalogGrid clientSort`. Artist URLs do not currently read `?page=`.
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
    { sort: 'newest', page: 1, pageSize },
    { publishedOnly: false, useStatic: true },
  );
  const products = result?.data ?? [];
  const count = result?.count ?? 0;

  return (
    <div>
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

      {/* Products Grid. `id="products"` is the hero's "Shop the collection"
          scroll target — without it the CTA silently did nothing. */}
      <section id="products" className="py-24 bg-surface-page scroll-mt-20">
        <Container>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <h2 className="font-display-alt text-[clamp(2rem,4.4vw,3.5rem)] font-extrabold leading-[0.95] text-text-primary">
              Shop {artist.name}
              <span className="ml-3 align-top font-body text-[0.32em] font-semibold text-text-muted tabular-nums">
                {count}
              </span>
            </h2>
            {/* The full filter panel lives on /products; this page prerenders
                and does not read searchParams. */}
            <Link
              href={buildFilterUrl({ artist: handle }, {})}
              className="pc-cta inline-flex items-center gap-2 font-body text-sm font-semibold text-text-primary hover:text-accent"
            >
              Filter by size and price
              <ArrowDiag className="pc-cta__arrow" />
            </Link>
          </div>
          <CatalogGrid
            initialProducts={products}
            totalCount={count}
            initialPage={1}
            query={{ mode: 'artist', handle, sort: 'newest', pageSize }}
            showSort
            clientSort
            emptyTitle="No products found"
            emptyMessage={`Check back soon for new ${artist.name} merchandise.`}
            pageOneHref={`/artist/${handle}`}
          />
        </Container>
      </section>
    </div>
  );
}
