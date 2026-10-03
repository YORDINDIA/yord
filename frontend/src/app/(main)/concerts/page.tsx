import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Music, MapPin, Calendar, ArrowRight, Ticket } from 'lucide-react';
import { CONCERTS, type Concert } from '@/lib/data/concerts';
import { CITIES } from '@/lib/data/cities';
import { ARTISTS } from '@yord/db-types';
import { getConcertProductsCached } from '@/lib/supabase/cached-queries';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { ConcertCard } from '@/features/concerts/ConcertCard';
import { merchArtistsFromMap } from '@/features/concerts/concertProducts';
import { getConcertImage } from '@/features/concerts/concertImages';
import { getDaysUntil, getUrgencyLabel, formatConcertDate } from '@/features/concerts/concertDates';
import { JsonLd, breadcrumbSchema, itemListSchema } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Upcoming Concerts in India 2026-2027 | Buy Concert Merchandise',
  description:
    'Upcoming concerts in India 2026-2027. Diljit Dosanjh Aura Tour, Guns N Roses, Anyma, Fred again.., Khalid, The Chainsmokers, Sunburn Festival, Gorillaz, Foo Fighters & more. Shop exclusive concert merchandise at YORD India.',
  openGraph: {
    title: 'Upcoming Concerts in India 2026-2027 | YORD India',
    description:
      'All major upcoming concerts and music festivals in India 2026-2027. Shop premium concert merchandise for every show.',
    type: 'website',
  },
  alternates: { canonical: '/concerts' },
};

export const revalidate = 3600;

/**
 * Artist handles with at least one live product. List cards no longer render
 * products; this read exists only to gate the SHOP MERCH link, because
 * `/artist/[handle]` 404s when the artist has no collection row.
 */
async function loadMerchArtists(): Promise<Set<string>> {
  if (isSupabaseUnconfigured()) return new Set();
  const handles = [...new Set(CONCERTS.map((c) => c.artistHandle))];
  const result = await degrade(
    getConcertProductsCached(handles, 1),
    {},
    'concerts:listing',
    'products'
  );
  return result.ok ? merchArtistsFromMap(result.value) : new Set();
}

export default async function ConcertsPage() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const merchArtists = await loadMerchArtists();

  const byDate = [...CONCERTS].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const nextUp = byDate.find(
    (c) => c.status === 'upcoming' && getDaysUntil(c.date, now) >= 0
  );

  const concertsByYear: Record<number, Concert[]> = {};
  byDate.forEach((c) => {
    if (!concertsByYear[c.year]) concertsByYear[c.year] = [];
    concertsByYear[c.year].push(c);
  });
  const years = Object.keys(concertsByYear)
    .map(Number)
    .sort((a, b) => a - b);

  const nextUpArtist = nextUp ? ARTISTS[nextUp.artistHandle] : undefined;
  const nextUpAccent = nextUpArtist?.accentColor || 'var(--accent)';
  const nextUpImage = nextUp ? getConcertImage(nextUp) : undefined;

  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
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
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Music className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4">
            Upcoming Concerts in India 2026–2027
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-text-muted max-w-3xl mx-auto text-lg">
            YORD India is your destination for premium concert merchandise. Browse every major upcoming concert and music festival in India — from Diljit Dosanjh&apos;s Aura Tour and Guns N&apos; Roses to Fred again.., Khalid, The Chainsmokers, Sunburn, Gorillaz, and Foo Fighters — and shop exclusive fan-made merchandise to remember the night forever.
          </p>
        </div>

        {/* Next up spotlight */}
        {nextUp && (
          <section className="mb-16 bg-surface-card border border-border-default overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {nextUpImage && (
                <Link
                  href={`/concerts/${nextUp.slug}`}
                  className="relative block md:w-2/5 min-h-64 md:min-h-80 shrink-0"
                >
                  <Image
                    src={nextUpImage}
                    alt={`${nextUp.artist} live in concert`}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
                </Link>
              )}
              <div className="flex-1 p-8 md:p-12">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-[0.2em] bg-accent-tint-strong text-accent">
                    NEXT UP
                  </span>
                  <span className="px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-[0.2em] bg-black/60 text-white">
                    {getUrgencyLabel(getDaysUntil(nextUp.date, now))}
                  </span>
                </div>
                <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-text-primary mb-1">
                  {nextUp.artist}
                </h2>
                <p className="font-[family-name:var(--font-cormorant)] text-xl text-text-muted mb-4">
                  {nextUp.tourName}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-text-muted mb-6">
                  <span className="flex items-center gap-2 text-sm font-[family-name:var(--font-jakarta)]">
                    <Calendar size={16} style={{ color: nextUpAccent }} />
                    {formatConcertDate(nextUp.date)}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-[family-name:var(--font-jakarta)]">
                    <MapPin size={16} style={{ color: nextUpAccent }} />
                    {nextUp.venue !== 'TBA' ? `${nextUp.venue}, ` : ''}{nextUp.city}
                  </span>
                  {nextUp.ticketUrl && (
                    <a
                      href={nextUp.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="flex items-center gap-2 text-sm font-[family-name:var(--font-jakarta)] text-accent hover:underline"
                    >
                      <Ticket size={16} />
                      Get tickets
                      {nextUp.ticketPriceFrom ? ` from ₹${nextUp.ticketPriceFrom.toLocaleString('en-IN')}` : ''}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={`/concerts/${nextUp.slug}`}
                    className="inline-flex items-center gap-2 px-8 py-3 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-text-on-brand transition-colors"
                    style={{ backgroundColor: nextUpAccent }}
                  >
                    VIEW CONCERT <ArrowRight size={16} />
                  </Link>
                  {merchArtists.has(nextUp.artistHandle) && (
                    <Link
                      href={`/artist/${nextUp.artistHandle}`}
                      className="inline-flex items-center gap-2 px-8 py-3 border border-border-strong text-text-muted font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-accent hover:text-accent transition-colors"
                    >
                      SHOP MERCH
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="h-0.5 w-full" style={{ backgroundColor: nextUpAccent }} />
          </section>
        )}

        {/* City Quick Links */}
        <div className="mb-16">
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-muted mb-4">
            BROWSE BY CITY
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/concerts/city/${city.slug}`}
                className="px-4 py-2 bg-surface-card border border-border-default text-text-muted text-sm font-[family-name:var(--font-jakarta)] hover:border-accent hover:text-accent transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Concerts by Year */}
        {years.map((year) => (
          <section key={year} className="mb-16">
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl text-text-primary mb-8 border-b border-border-default pb-4">
              {year}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {concertsByYear[year].map((concert, i) => (
                <ConcertCard
                  key={concert.slug}
                  concert={concert}
                  hasMerch={merchArtists.has(concert.artistHandle)}
                  now={now}
                  priority={year === years[0] && i < 3}
                />
              ))}
            </div>
          </section>
        ))}

        {/* SEO Content Block */}
        <section className="mt-16 bg-surface-card border border-border-default p-8 md:p-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6">
            Buy Concert Merchandise in India
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              YORD India is India&apos;s premier destination for premium concert merchandise. Whether you&apos;re heading to Diljit Dosanjh&apos;s Aura World Tour at the Narendra Modi Stadium, Guns N&apos; Roses in Bengaluru and Guwahati, Anyma&apos;s ÆDEN show in Mumbai, or Fred again..&apos;s debut tour across Delhi, Mumbai, and Bengaluru — we have exclusive, fan-made designs to commemorate your concert experience.
            </p>
            <p>
              The months ahead are packed: Khalid&apos;s long-awaited India debut across three cities, The Chainsmokers&apos; December return via Sunburn and the Indian Sneaker Festival, Sunburn Festival in Goa, and then a historic January 2027 with Gorillaz and Foo Fighters (with The Pretty Reckless) both playing Bengaluru and Mumbai. YORD India offers exclusive merchandise drops for these shows, with free shipping on orders above ₹1,999 and pan-India delivery.
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
