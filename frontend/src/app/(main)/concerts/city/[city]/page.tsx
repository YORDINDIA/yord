import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Calendar, Music, ChevronRight } from 'lucide-react';
import { CONCERTS } from '@/lib/data/concerts';
import { CITIES, getCityBySlug } from '@/lib/data/cities';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonld';

interface CityPageProps {
  params: Promise<{ city: string }>;
}

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
    title: `Concerts in ${city.name} 2025-2026 | Buy Concert Merchandise`,
    description: `All concerts and music events in ${city.name}, India. Buy premium concert merchandise for ${city.name} shows at YORD India. ${city.description.slice(0, 100)}`,
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
  );

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
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
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-4">
            Concerts in {city.name}
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-3xl mx-auto">
            {city.description}
          </p>
        </div>

        {/* Venues */}
        <div className="mb-12">
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-ivory-400 mb-4">
            POPULAR VENUES IN {city.name.toUpperCase()}
          </h2>
          <div className="flex flex-wrap gap-2">
            {city.venues.map((venue) => (
              <span
                key={venue}
                className="px-3 py-1 bg-noir-900 border border-noir-800 text-ivory-300 text-sm"
              >
                {venue}
              </span>
            ))}
          </div>
        </div>

        {/* Concerts */}
        {cityConcerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {cityConcerts.map((concert) => (
              <Link
                key={concert.slug}
                href={`/concerts/${concert.slug}`}
                className="group block bg-noir-900 border border-noir-800 p-6 hover:border-gold-200/40 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`px-2 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider ${
                      concert.status === 'completed'
                        ? 'bg-noir-800 text-ivory-400'
                        : concert.status === 'upcoming'
                          ? 'bg-gold-200/20 text-gold-200'
                          : 'bg-emerald-900/30 text-emerald-400'
                    }`}
                  >
                    {concert.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-ivory-400">{concert.year}</span>
                </div>
                <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-50 mb-1 group-hover:text-gold-200 transition-colors">
                  {concert.artist}
                </h3>
                <p className="font-[family-name:var(--font-cormorant)] text-ivory-300 mb-3">
                  {concert.tourName}
                </p>
                <div className="flex items-center gap-2 text-sm text-ivory-400">
                  <Calendar size={14} />
                  {new Date(concert.date).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="mt-4 flex items-center gap-1 text-gold-200 text-sm font-[family-name:var(--font-bebas)] tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                  SHOP MERCH <ChevronRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 mb-16">
            <Music className="w-16 h-16 mx-auto text-ivory-600 mb-4" />
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400">
              No concerts listed for {city.name} yet. Check back soon!
            </p>
          </div>
        )}

        {/* SEO Content */}
        <section className="bg-noir-900 border border-noir-800 p-8 md:p-12 mb-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-6">
            Buy Concert Merchandise in {city.name}
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-ivory-300 space-y-4 text-sm leading-relaxed">
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
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-ivory-400 mb-4">
            CONCERTS IN OTHER CITIES
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.filter((c) => c.slug !== citySlug).map((otherCity) => (
              <Link
                key={otherCity.slug}
                href={`/concerts/city/${otherCity.slug}`}
                className="px-4 py-2 bg-noir-900 border border-noir-700 text-ivory-300 text-sm font-[family-name:var(--font-jakarta)] hover:border-gold-200 hover:text-gold-200 transition-colors"
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
