import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { CONCERTS, getConcertBySlug, getConcertsByArtist } from '@/lib/data/concerts';
import { ARTISTS } from '@yord/db-types';
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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
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
  const relatedConcerts = getConcertsByArtist(concert.artistHandle).filter(
    (c) => c.slug !== concert.slug
  );

  return (
    <ConcertDetail
      concert={concert}
      slug={slug}
      accentColor={artistData?.accentColor || '#D4AF37'}
      hasMerchLink={!!artistData}
      relatedConcerts={relatedConcerts}
    />
  );
}
