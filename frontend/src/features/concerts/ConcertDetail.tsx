import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MapPin, Music, Tag, Users } from 'lucide-react';
import type { TransformedProductWithSource } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import type { Concert } from '@/lib/data/concerts';
import { CITIES, getCitySlugByName } from '@/lib/data/cities';
import { JsonLd, eventSchema, breadcrumbSchema } from '@/lib/seo/jsonld';
import { ConcertHero } from './ConcertHero';
import { ConcertMerchRail } from './ConcertMerchRail';
import { ConcertRelated } from './ConcertRelated';
import { formatConcertDateLong } from './concertDates';

interface ConcertDetailProps {
  concert: Concert;
  slug: string;
  accentColor: string;
  artistBio?: string;
  image?: string;
  imageCredit?: string;
  products: TransformedProductWithSource[];
  relatedConcerts: Concert[];
  now: number;
}

/**
 * Presentational body for `/concerts/[slug]`; data + metadata stay in the route.
 * A composition of the hero, the fact grid, the merch rail and the two
 * cross-link sections — each of which used to live inline in this one file.
 */
export function ConcertDetail({
  concert,
  slug,
  accentColor,
  artistBio,
  image,
  imageCredit,
  products,
  relatedConcerts,
  now,
}: ConcertDetailProps) {
  const hasMerch = products.length > 0;

  const details: { icon: typeof MapPin; label: string; value: string }[] = [
    { icon: Calendar, label: 'DATE', value: formatConcertDateLong(concert.date) },
    {
      icon: MapPin,
      label: 'VENUE',
      value: concert.venue !== 'TBA' ? `${concert.venue}, ${concert.city}` : concert.city,
    },
  ];
  if (concert.startTime) details.push({ icon: Clock, label: 'DOORS', value: concert.startTime });
  if (concert.ticketPriceFrom)
    details.push({ icon: Tag, label: 'TICKETS FROM', value: formatPrice(concert.ticketPriceFrom) });
  if (concert.supportActs && concert.supportActs.length > 0)
    details.push({ icon: Users, label: 'SUPPORT', value: concert.supportActs.join(', ') });

  return (
    <main className="min-h-screen bg-surface-page pt-20">
      <JsonLd data={eventSchema(concert, image)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
          { name: `${concert.artist} — ${concert.city}`, url: `/concerts/${slug}` },
        ])}
      />

      {/* Back Navigation */}
      <div className="container-page py-6">
        <Link
          href="/concerts"
          className="inline-flex items-center gap-2 text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="font-accent tracking-wider text-sm">ALL CONCERTS</span>
        </Link>
      </div>

      <ConcertHero
        concert={concert}
        accentColor={accentColor}
        image={image}
        imageCredit={imageCredit}
        hasMerch={hasMerch}
        now={now}
      />

      {/* Show details */}
      <section className="container-page pb-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {details.map((detail) => (
            <div key={detail.label} className="bg-surface-card border border-border-default p-5">
              <detail.icon size={18} aria-hidden="true" className="text-accent mb-3" />
              <p className="font-accent text-xs tracking-[0.2em] text-text-muted mb-1">
                {detail.label}
              </p>
              <p className="font-body text-sm text-text-secondary">{detail.value}</p>
            </div>
          ))}
        </div>

        {concert.keySongs && concert.keySongs.length > 0 ? (
          <div className="mt-4 bg-surface-card border border-border-default p-5">
            <p className="font-accent text-xs tracking-[0.2em] text-text-muted mb-3 flex items-center gap-2">
              <Music size={14} aria-hidden="true" className="text-accent" /> EXPECT TO HEAR
            </p>
            <div className="flex flex-wrap gap-2">
              {concert.keySongs.map((song) => (
                <span
                  key={song}
                  className="px-3 py-1.5 bg-surface-raised border border-border-default text-sm text-text-secondary font-body"
                >
                  {song}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* About the artist */}
      {artistBio ? (
        <section className="container-page pb-12">
          <div className="bg-surface-card/50 border border-border-default p-8 md:p-12">
            <h2 className="font-display text-2xl text-text-primary mb-4">
              About {concert.artist}
            </h2>
            <p className="font-body text-text-muted text-sm leading-relaxed max-w-3xl">
              {artistBio}
            </p>
          </div>
        </section>
      ) : null}

      <ConcertMerchRail concert={concert} products={products} />

      <ConcertRelated artist={concert.artist} concerts={relatedConcerts} />

      {/* Browse by City */}
      <section className="bg-surface-card border-t border-border-default py-12">
        <div className="container-page">
          <h2 className="font-accent text-sm tracking-[0.2em] text-text-muted mb-4">
            CONCERTS IN OTHER CITIES
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/concerts/city/${getCitySlugByName(concert.city)}`}
              className="px-4 py-2 bg-accent-tint border border-accent/40 text-accent text-sm font-body"
            >
              {concert.city}
            </Link>
            {CITIES.filter((city) => city.name !== concert.city).map((city) => (
              <Link
                key={city.slug}
                href={`/concerts/city/${city.slug}`}
                className="px-4 py-2 bg-surface-raised border border-border-default text-text-muted text-sm font-body hover:border-accent hover:text-accent transition-colors"
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
