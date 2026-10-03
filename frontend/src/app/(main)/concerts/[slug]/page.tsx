import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { CONCERTS, getConcertBySlug, getConcertsByArtist } from '@/lib/data/concerts';
import { ARTISTS } from '@yord/db-types';
import { getConcertProductsCached } from '@/lib/supabase/cached-queries';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { toConcertCardProducts } from '@/features/concerts/concertProducts';
import { getConcertImage, getConcertImageCredit } from '@/features/concerts/concertImages';
import { ConcertDetail } from '@/features/concerts/ConcertDetail';

interface ConcertPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CONCERTS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: ConcertPageProps): Promise<Metadata> {
  const { slug } = await params;
  const concert = getConcertBySlug(slug);

  if (!concert) {
    return { title: 'Concert Not Found' };
  }

  const title = `${concert.artist} — ${concert.tourName} in ${concert.city} | Concert Merchandise`;
  const description = `${concert.description.slice(0, 155)}...`;
  const heroImage = getConcertImage(concert);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(heroImage ? { images: [{ url: `https://yordindia.com${heroImage}` }] } : {}),
    },
    alternates: { canonical: `/concerts/${slug}` },
  };
}

export default async function ConcertPage({ params }: ConcertPageProps) {
  const { slug } = await params;
  const concert = getConcertBySlug(slug);

  if (!concert) {
    notFound();
  }

  const artistData = ARTISTS[concert.artistHandle];
  const accentColor = artistData?.accentColor || 'var(--accent)';
  const relatedConcerts = getConcertsByArtist(concert.artistHandle).filter(
    (c) => c.slug !== concert.slug
  );

  let products = toConcertCardProducts([], accentColor, concert.artist);
  if (!isSupabaseUnconfigured()) {
    const result = await degrade(
      getConcertProductsCached([concert.artistHandle], 8),
      {},
      `concerts:detail-${concert.artistHandle}`,
      'products'
    );
    if (result.ok) {
      products = toConcertCardProducts(
        result.value[concert.artistHandle] || [],
        accentColor,
        artistData?.name || concert.artist
      );
    }
  }

  return (
    <ConcertDetail
      concert={concert}
      slug={slug}
      accentColor={accentColor}
      artistBio={artistData?.bio}
      image={getConcertImage(concert)}
      imageCredit={getConcertImageCredit(concert)}
      products={products}
      relatedConcerts={relatedConcerts}
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
    />
  );
}
