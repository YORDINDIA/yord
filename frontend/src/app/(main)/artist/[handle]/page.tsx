import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getArtistByHandle, getArtistsWithMetadata } from '@/lib/supabase/queries';
import { ArtistHero } from '@/components/artist/ArtistHero';
import { ArtistProducts } from '@/components/artist/ArtistProducts';
import { JsonLd, musicGroupSchema, breadcrumbSchema } from '@/lib/seo/jsonld';
import { getConcertsByArtist } from '@/lib/data/concerts';

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

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { handle } = await params;
  // Static (cookie-free) client so `revalidate = 3600` actually applies.
  const artist = await getArtistByHandle(handle, true);

  if (!artist) {
    notFound();
  }

  const artistConcerts = getConcertsByArtist(handle);

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
      <ArtistProducts artist={artist} />
    </main>
  );
}
