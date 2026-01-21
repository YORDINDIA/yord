import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getArtistByHandle, getArtistsWithMetadata } from '@/lib/supabase/queries';
import { ArtistHero } from '@/components/artist/ArtistHero';
import { ArtistProducts } from '@/components/artist/ArtistProducts';

interface ArtistPageProps {
  params: Promise<{ handle: string }>;
}

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
    title: `${artist.name} Collection | YORD India`,
    description: `Shop exclusive ${artist.name} inspired merchandise. ${artist.tagline}. Premium quality, fan-made designs.`,
    openGraph: {
      title: `${artist.name} Collection | YORD India`,
      description: `Shop exclusive ${artist.name} concert merchandise. ${artist.tagline}.`,
      type: 'website',
    },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { handle } = await params;
  const artist = await getArtistByHandle(handle);

  if (!artist) {
    notFound();
  }

  return (
    <main>
      {/* Immersive Hero with Artist Branding */}
      <ArtistHero artist={artist} />

      {/* Products Grid */}
      <ArtistProducts artist={artist} />
    </main>
  );
}
