import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { CONCERTS } from '@/lib/data/concerts';
import { CITIES, getCityBySlug } from '@/lib/data/cities';
import { getConcertProductsCached } from '@/lib/supabase/cached-queries';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { ConcertCard } from '@/features/concerts/ConcertCard';
import { merchArtistsFromMap } from '@/features/concerts/concertProducts';
import { EmptyState } from '@/features/ui/EmptyState';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonld';

interface CityPageProps {
  params: Promise<{ city: string }>;
}

export const revalidate = 3600;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);

  if (!city) {
    return { title: 'City Not Found' };
  }

  return {
    title: `Concerts in ${city.name} 2026-2027 | Buy Concert Merchandise`,
    description: `Upcoming concerts and music events in ${city.name}, India. Buy premium concert merchandise for ${city.name} shows at YORD India. ${city.description.slice(0, 100)}`,
    openGraph: {
      title: `Concerts in ${city.name} | YORD India`,
      description: `Browse concerts in ${city.name} and shop exclusive concert merchandise.`,
      type: 'website',
    },
    alternates: { canonical: `/concerts/city/${citySlug}` },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);

  if (!city) {
    notFound();
  }

  const cityConcerts = CONCERTS.filter(
    (c) => c.city.toLowerCase() === city.name.toLowerCase()
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  // Cards no longer render products; this read only gates the SHOP MERCH
  // link, because `/artist/[handle]` 404s without a collection row.
  let merchArtists: Set<string> = new Set();
  if (!isSupabaseUnconfigured()) {
    const handles = [...new Set(cityConcerts.map((c) => c.artistHandle))];
    const result = await degrade(
      getConcertProductsCached(handles, 1),
      {},
      `concerts:city-${citySlug}`,
      'products'
    );
    if (result.ok) merchArtists = merchArtistsFromMap(result.value);
  }

  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
          { name: city.name, url: `/concerts/city/${citySlug}` },
        ])}
      />
      {/* Only emitted when the page actually renders a list: an empty ItemList
          for a city with no shows describes nothing. */}
      {cityConcerts.length > 0 ? (
        <JsonLd
          data={itemListSchema(
            cityConcerts.map((c, i) => ({
              name: `${c.artist} — ${c.tourName}`,
              url: `/concerts/${c.slug}`,
              position: i + 1,
            }))
          )}
        />
      ) : null}

      <div className="container-page">
        {/* Hero */}
        <div className="mb-16">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <MapPin aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <SectionHeading as="h1" align="center" title={`Concerts in ${city.name}`} description={city.description} />
        </div>

        {/* Venues */}
        <div className="mb-12">
          <h2 className="font-accent text-sm tracking-[0.2em] text-text-muted mb-4">
            POPULAR VENUES IN {city.name.toUpperCase()}
          </h2>
          <div className="flex flex-wrap gap-2">
            {city.venues.map((venue) => (
              <span
                key={venue}
                className="px-3 py-1 bg-surface-card border border-border-default text-text-muted text-sm"
              >
                {venue}
              </span>
            ))}
          </div>
        </div>

        {/* Concerts */}
        {cityConcerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {cityConcerts.map((concert, i) => (
              <ConcertCard
                key={concert.slug}
                concert={concert}
                hasMerch={merchArtists.has(concert.artistHandle)}
                now={now}
                priority={i < 3}
              />
            ))}
          </div>
        ) : (
          <div className="mb-16">
            <EmptyState
              title={`No concerts in ${city.name} yet`}
              message="New dates are added as tours are announced. Browse every upcoming show in the meantime."
            >
              <Link href="/concerts" className="text-accent font-accent tracking-wider text-sm hover:underline">
                ALL CONCERTS
              </Link>
            </EmptyState>
          </div>
        )}

        {/* SEO Content */}
        <section className="bg-surface-card border border-border-default p-8 md:p-12 mb-12">
          <SectionHeading as="h2" title={`Buy Concert Merchandise in ${city.name}`} className="mb-6" />
          <div className="font-body text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              {city.name} is one of India&apos;s top concert destinations, hosting both international and Indian artists throughout the year. YORD India delivers premium concert merchandise to {city.name} and across {city.state} with free shipping on every order.
            </p>
            <p>
              Whether you&apos;re attending a show at {city.venues[0]} or {city.venues[1] || 'other venues'}, shop exclusive fan-made t-shirts, hoodies, and accessories before or after the concert. Our designs celebrate the artists you love with premium quality and unique aesthetics.
            </p>
          </div>
        </section>

        {/* Other Cities */}
        <div>
          <h2 className="font-accent text-sm tracking-[0.2em] text-text-muted mb-4">
            CONCERTS IN OTHER CITIES
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.filter((c) => c.slug !== citySlug).map((otherCity) => (
              <Link
                key={otherCity.slug}
                href={`/concerts/city/${otherCity.slug}`}
                className="px-4 py-2 bg-surface-card border border-border-default text-text-muted text-sm font-body hover:border-accent hover:text-accent transition-colors"
              >
                {otherCity.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
