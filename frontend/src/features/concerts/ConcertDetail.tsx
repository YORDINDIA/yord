import Link from 'next/link';
import { MapPin, Calendar, ArrowLeft, ShoppingBag } from 'lucide-react';
import type { Concert } from '@/lib/data/concerts';
import { getCitySlugByName } from '@/lib/data/cities';
import { JsonLd, eventSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

interface ConcertDetailProps {
  concert: Concert;
  slug: string;
  accentColor: string;
  hasMerchLink: boolean;
  relatedConcerts: Concert[];
}

/** Presentational body for `/concerts/[slug]`; data + metadata stay in the route. */
export function ConcertDetail({ concert, slug, accentColor, hasMerchLink, relatedConcerts }: ConcertDetailProps) {
  return (
    <main className="min-h-screen bg-surface-page pt-20">
      <JsonLd data={eventSchema(concert)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concerts', url: '/concerts' },
          { name: `${concert.artist} — ${concert.city}`, url: `/concerts/${slug}` },
        ])}
      />

      {/* Back Navigation */}
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-6">
        <Link
          href="/concerts"
          className="inline-flex items-center gap-2 text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="font-[family-name:var(--font-bebas)] tracking-wider text-sm">
            ALL CONCERTS
          </span>
        </Link>
      </div>

      {/* Concert Hero */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
        <div className="bg-surface-card border border-border-default p-8 md:p-12 lg:p-16">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider ${
                concert.status === 'completed'
                  ? 'bg-surface-raised text-text-muted'
                  : concert.status === 'upcoming'
                    ? 'bg-accent-tint-strong text-accent'
                    : 'bg-emerald-900/30 text-emerald-400'
              }`}
            >
              {concert.status.toUpperCase()}
            </span>
            <span className="text-sm text-text-muted font-[family-name:var(--font-jakarta)]">
              {concert.genre}
            </span>
          </div>

          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-text-primary mb-3">
            {concert.artist}
          </h1>
          <p
            className="font-[family-name:var(--font-cormorant)] text-2xl md:text-3xl mb-6"
            style={{ color: 'var(--accent)' }}
          >
            {concert.tourName}
          </p>

          <div className="flex flex-wrap gap-6 text-text-muted mb-8">
            <div className="flex items-center gap-2">
              <MapPin size={18} style={{ color: accentColor }} />
              <span className="font-[family-name:var(--font-jakarta)]">
                {concert.venue}, {concert.city}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={18} style={{ color: accentColor }} />
              <span className="font-[family-name:var(--font-jakarta)]">
                {new Date(concert.date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <p className="font-[family-name:var(--font-jakarta)] text-text-muted text-lg leading-relaxed max-w-3xl">
            {concert.description}
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap gap-4">
            {hasMerchLink && (
              <Link
                href={`/artist/${concert.artistHandle}`}
                className="inline-flex items-center gap-2 px-8 py-3 text-text-on-brand font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                <ShoppingBag size={16} />
                SHOP {concert.artist.toUpperCase()} MERCH
              </Link>
            )}
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-8 py-3 border border-border-strong text-text-muted font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-accent hover:text-accent transition-colors"
            >
              BROWSE ALL PRODUCTS
            </Link>
          </div>
        </div>
      </section>

      {/* Concert Merch Guide */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
        <div className="bg-surface-card/50 border border-border-default p-8 md:p-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6">
            {concert.artist} Concert Merchandise Guide
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              Looking for {concert.artist} merchandise for the {concert.tourName}? YORD India offers exclusive, premium fan-made designs that let you commemorate your concert experience. Our {concert.artist} collection features t-shirts, hoodies, and accessories inspired by the artist&apos;s iconic aesthetic.
            </p>
            <p>
              Whether you{' '}
              {concert.status === 'completed'
                ? `attended the show at ${concert.venue} in ${concert.city}`
                : `are planning to attend the show at ${concert.venue} in ${concert.city}`}
              , wearing concert merchandise is the best way to show your love for {concert.artist}. Our designs are printed on premium-quality fabric, ensuring comfort and durability.
            </p>
            <p>
              Shop the complete {concert.artist} collection at YORD India with free shipping on orders above ₹1,999 and pan-India delivery. All products come with easy returns and exchanges.
            </p>
          </div>
        </div>
      </section>

      {/* Related Concerts */}
      {relatedConcerts.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-16">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6">
            More {concert.artist} Concerts in India
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedConcerts.map((rc) => (
              <Link
                key={rc.slug}
                href={`/concerts/${rc.slug}`}
                className="group block bg-surface-card border border-border-default p-6 hover:border-accent/40 transition-all"
              >
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-text-secondary group-hover:text-accent transition-colors">
                  {rc.tourName}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {rc.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />{' '}
                    {new Date(rc.date).toLocaleDateString('en-IN', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Browse by City */}
      <section className="bg-surface-card border-t border-border-default py-12">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <h2 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-text-muted mb-4">
            CONCERTS IN OTHER CITIES
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/concerts/city/${getCitySlugByName(concert.city)}`}
              className="px-4 py-2 bg-accent-tint-strong border border-accent/40 text-accent text-sm font-[family-name:var(--font-jakarta)]"
            >
              {concert.city}
            </Link>
            {['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Ahmedabad', 'Goa']
              .filter((c) => c !== concert.city)
              .map((city) => (
                <Link
                  key={city}
                  href={`/concerts/city/${getCitySlugByName(city)}`}
                  className="px-4 py-2 bg-surface-raised border border-border-default text-text-muted text-sm font-[family-name:var(--font-jakarta)] hover:border-accent hover:text-accent transition-colors"
                >
                  {city}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </main>
  );
}
