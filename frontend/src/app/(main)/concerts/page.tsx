import { Metadata } from 'next';
import Link from 'next/link';
import { Music, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { CONCERTS, getConcertCities } from '@/lib/data/concerts';
import { CITIES } from '@/lib/data/cities';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Concerts in India 2025-2026 | Buy Concert Merchandise',
  description:
    'Complete list of concerts in India 2025-2026. Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Def Leppard, Tiësto, Linkin Park, John Mayer & more. Shop exclusive concert merchandise at YORD India.',
  openGraph: {
    title: 'Concerts in India 2025-2026 | YORD India',
    description:
      'All major concerts and music festivals in India 2025-2026. Shop premium concert merchandise for every show.',
    type: 'website',
  },
  alternates: { canonical: '/concerts' },
};

export default function ConcertsPage() {
  const concertsByYear: Record<number, typeof CONCERTS> = {};
  CONCERTS.forEach((c) => {
    if (!concertsByYear[c.year]) concertsByYear[c.year] = [];
    concertsByYear[c.year].push(c);
  });

  const years = Object.keys(concertsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  const cities = getConcertCities();

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
        ])}
      />
      <JsonLd
        data={itemListSchema(
          CONCERTS.slice(0, 50).map((c, i) => ({
            name: `${c.artist} — ${c.tourName}`,
            url: `/concerts/${c.slug}`,
            position: i + 1,
          }))
        )}
      />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <Music className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-4">
            Concerts in India 2025–2026
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-3xl mx-auto text-lg">
            YORD India is your destination for premium concert merchandise. Browse every major concert and music festival happening in India — from Coldplay and Diljit Dosanjh to Lollapalooza and Sunburn — and shop exclusive fan-made merchandise to remember the night forever.
          </p>
        </div>

        {/* City Quick Links */}
        <div className="mb-16">
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-ivory-400 mb-4">
            BROWSE BY CITY
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/concerts/city/${city.slug}`}
                className="px-4 py-2 bg-noir-900 border border-noir-700 text-ivory-300 text-sm font-[family-name:var(--font-jakarta)] hover:border-gold-200 hover:text-gold-200 transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Concerts by Year */}
        {years.map((year) => (
          <section key={year} className="mb-16">
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-8 border-b border-noir-800 pb-4">
              {year}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {concertsByYear[year].map((concert) => (
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
                    <span className="text-xs text-ivory-400 font-[family-name:var(--font-jakarta)]">
                      {concert.genre}
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-50 mb-1 group-hover:text-gold-200 transition-colors">
                    {concert.artist}
                  </h3>
                  <p className="font-[family-name:var(--font-cormorant)] text-ivory-300 mb-3">
                    {concert.tourName}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-ivory-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {concert.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(concert.date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-gold-200 text-sm font-[family-name:var(--font-bebas)] tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                    SHOP MERCH <ChevronRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* SEO Content Block */}
        <section className="mt-16 bg-noir-900 border border-noir-800 p-8 md:p-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-6">
            Buy Concert Merchandise in India
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-ivory-300 space-y-4 text-sm leading-relaxed">
            <p>
              YORD India is India&apos;s premier destination for premium concert merchandise. Whether you attended the Coldplay Music of the Spheres World Tour in Mumbai and Ahmedabad, Diljit Dosanjh&apos;s record-breaking Dil-Luminati Tour, Karan Aujla&apos;s It Was All A Dream Tour, or John Mayer&apos;s historic India debut in Mumbai — we have exclusive, fan-made designs to commemorate your concert experience.
            </p>
            <p>
              2026 has brought a wave of iconic concerts to India: Lollapalooza India 2026 in Mumbai headlined by Linkin Park and Playboi Carti, Tiësto&apos;s three-city India tour, DJ Snake&apos;s six-city India blitz, Dream Theater&apos;s 40th Anniversary Tour, The Lumineers&apos; Automatic World Tour in Delhi NCR, and John Mayer&apos;s long-awaited India solo debut. Coming up: Kanye West&apos;s India debut in Delhi, Calvin Harris&apos;s first-ever India shows across Bengaluru, Mumbai and Delhi, Def Leppard&apos;s India Tour from Shillong to Bengaluru, and Karan Aujla&apos;s massive P-Pop Culture World Tour across six Indian cities.
            </p>
            <p>
              Major music festivals like Lollapalooza India in Mumbai, Sunburn Festival in Goa, and NH7 Weekender in Pune have made India a global concert destination. YORD India offers exclusive festival merchandise for all these events, with free shipping on orders above ₹1,999 and pan-India delivery.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
