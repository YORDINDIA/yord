import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Music } from 'lucide-react';
import { CONCERTS } from '@/lib/data/concerts';
import { CITIES, getCityBySlug } from '@/lib/data/cities';
import { getConcertProductsCached } from '@/lib/supabase/cached-queries';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { ConcertCard } from '@/features/concerts/ConcertCard';
import { merchArtistsFromMap } from '@/features/concerts/concertProducts';
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
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
          { name: city.name, url: `/concerts/city/${citySlug}` },
        ])}
      />
      {cityConcerts.length > 0 && (
        <JsonLd
          data={itemListSchema(
            cityConcerts.map((c, i) => ({
              name: `${c.artist} — ${c.tourName}`,
              url: `/concerts/${c.slug}`,
              position: i + 1,
            }))
          )}
        />
      )}

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            Concerts in {city.name}
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-3xl mx-auto">
            {city.description}
          </p>
        </div>

        {/* Venues */}
        <div className="mb-12">
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-muted mb-4">
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
          <div className="text-center py-16 mb-16">
            <Music className="w-16 h-16 mx-auto text-text-muted mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted">
              No concerts listed for {city.name} yet. Check back soon!
            </p>
          </div>
        )}

        {/* SEO Content */}
        <section className="bg-surface-card border border-border-default p-8 md:p-12 mb-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6">
            Buy Concert Merchandise in {city.name}
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              {city.name} is one of India&apos;s top concert destinations, hosting both international and Indian artists throughout the year. YORD India delivers premium concert merchandise to {city.name} and across {city.state} with free shipping on orders above ₹1,999.
            </p>
            <p>
              Whether you&apos;re attending a show at {city.venues[0]} or {city.venues[1] || 'other venues'}, shop exclusive fan-made t-shirts, hoodies, and accessories before or after the concert. Our designs celebrate the artists you love with premium quality and unique aesthetics.
            </p>
          </div>
        </section>

        {/* Other Cities */}
        <div>
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-muted mb-4">
            CONCERTS IN OTHER CITIES
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.filter((c) => c.slug !== citySlug).map((otherCity) => (
              <Link
                key={otherCity.slug}
                href={`/concerts/city/${otherCity.slug}`}
                className="px-4 py-2 bg-surface-card border border-border-default text-text-muted text-sm font-[family-name:var(--font-jakarta)] hover:border-accent hover:text-accent transition-colors"
              >
                {otherCity.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
