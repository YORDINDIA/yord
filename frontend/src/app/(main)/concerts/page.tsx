import { Metadata } from 'next';
import Link from 'next/link';
import { Music } from 'lucide-react';
import { CONCERTS, getConcertTours } from '@/lib/data/concerts';
import { CITIES } from '@/lib/data/cities';
import { getConcertProductsCached } from '@/lib/supabase/cached-queries';
import { degrade, isSupabaseUnconfigured } from '@/lib/result';
import { ConcertTourGroup } from '@/features/concerts/ConcertTourGroup';
import { merchArtistsFromMap } from '@/features/concerts/concertProducts';
import { SectionHeading } from '@/features/ui/SectionHeading';
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
  const tours = getConcertTours();
  const spotlight = tours[0]?.featured ? tours[0] : undefined;
  const rest = spotlight ? tours.slice(1) : tours;

  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
        ])}
      />
      {/* Describes the list as rendered: tours in display order, each tour's
          dates soonest first. */}
      <JsonLd
        data={itemListSchema(
          tours
            .flatMap((t) =>
              t.dates.map((d) => ({ name: `${t.artist} — ${t.tourName}, ${d.city}`, url: `/concerts/${d.slug}` }))
            )
            .map((item, i) => ({ ...item, position: i + 1 }))
        )}
      />

      <div className="container-page">
        {/* Hero */}
        <div className="mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <Music aria-hidden="true" className="w-8 h-8 text-accent" />
          </div>
          <SectionHeading
            as="h1"
            align="center"
            title="Upcoming Concerts in India 2026–2027"
            description="YORD India is your destination for premium concert merchandise. Browse every major upcoming concert and music festival in India — from Diljit Dosanjh's Aura Tour and Guns N' Roses to Fred again.., Khalid, The Chainsmokers, Sunburn, Gorillaz, and Foo Fighters — and shop exclusive fan-made merchandise to remember the night forever."
          />
        </div>

        {/* Headline concert */}
        {spotlight ? (
          <section className="mb-16" aria-label="Headline concert">
            <ConcertTourGroup
              tour={spotlight}
              hasMerch={merchArtists.has(spotlight.artistHandle)}
              now={now}
              priority
            />
          </section>
        ) : null}

        {/* City Quick Links */}
        <div className="mb-16">
          <h2 className="font-accent text-sm tracking-[0.2em] text-text-muted mb-4">
            BROWSE BY CITY
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <Link
                key={city.slug}
                href={`/concerts/city/${city.slug}`}
                className="px-4 py-2 bg-surface-card border border-border-default text-text-muted text-sm font-body hover:border-accent hover:text-accent transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Every concert, dates nested under the artist */}
        <section className="mb-16">
          <SectionHeading as="h2" title="All Concerts" className="mb-8" />
          <div className="flex flex-col gap-8">
            {rest.map((tour, i) => (
              <ConcertTourGroup
                key={`${tour.artistHandle}-${tour.tourName}`}
                tour={tour}
                hasMerch={merchArtists.has(tour.artistHandle)}
                now={now}
                priority={!spotlight && i === 0}
              />
            ))}
          </div>
        </section>

        {/* SEO Content Block */}
        <section className="mt-16 bg-surface-card border border-border-default p-8 md:p-12">
          <SectionHeading as="h2" title="Buy Concert Merchandise in India" className="mb-6" />
          <div className="font-body text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              YORD India is India&apos;s premier destination for premium concert merchandise. Whether you&apos;re heading to Diljit Dosanjh&apos;s Aura World Tour at the Narendra Modi Stadium, Guns N&apos; Roses in Bengaluru and Guwahati, Anyma&apos;s ÆDEN show in Mumbai, or Fred again..&apos;s debut tour across Delhi, Mumbai, and Bengaluru — we have exclusive, fan-made designs to commemorate your concert experience.
            </p>
            <p>
              The months ahead are packed: Khalid&apos;s long-awaited India debut across three cities, The Chainsmokers&apos; December return via Sunburn and the Indian Sneaker Festival, Sunburn Festival in Goa, and then a historic January 2027 with Gorillaz and Foo Fighters (with The Pretty Reckless) both playing Bengaluru and Mumbai. YORD India offers exclusive merchandise drops for these shows, with free shipping on every order and pan-India delivery.
            </p>
            <p>
              Major music festivals like Lollapalooza India in Mumbai, Sunburn Festival in Goa, and NH7 Weekender in Pune have made India a global concert destination. YORD India offers exclusive festival merchandise for all these events, with free shipping on every order and pan-India delivery.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
