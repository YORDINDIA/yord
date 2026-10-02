import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Calendar, ArrowLeft, ShoppingBag, Ticket, Music, Users, Clock, Tag } from 'lucide-react';
import type { TransformedProductWithSource } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import type { Concert } from '@/lib/data/concerts';
import { getConcertImage } from './concertImages';
import { getCitySlugByName } from '@/lib/data/cities';
import { ProductCard } from '@/features/ui/ProductCard';
import { JsonLd, eventSchema, breadcrumbSchema } from '@/lib/seo/jsonld';
import { getDaysUntil, getUrgencyLabel, formatConcertDateLong } from './concertDates';

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

/** Presentational body for `/concerts/[slug]`; data + metadata stay in the route. */
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
  const days = getDaysUntil(concert.date, now);
  const countdown =
    concert.status === 'announced' ? 'ANNOUNCED' : days < 0 ? null : getUrgencyLabel(days);
  const isUrgent = concert.status === 'upcoming' && days >= 0 && days <= 7;

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
        <div className="bg-surface-card border border-border-default overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {image && (
              <div className="md:w-2/5 shrink-0">
                <div className="relative aspect-square">
                  <Image
                    src={image}
                    alt={`${concert.artist} live in concert`}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover"
                    priority
                  />
                </div>
                {imageCredit && (
                  <p className="px-4 py-2 text-[11px] text-text-muted font-[family-name:var(--font-jakarta)]">
                    Photo: {imageCredit}
                  </p>
                )}
              </div>
            )}
            <div className="flex-1 p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className={`px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider ${
                    concert.status === 'upcoming'
                      ? 'bg-accent-tint-strong text-accent'
                      : 'bg-accent-tint text-accent'
                  }`}
                >
                  {concert.status.toUpperCase()}
                </span>
                {countdown && (
                  <span
                    className={`px-3 py-1 text-xs font-[family-name:var(--font-bebas)] tracking-wider bg-black/60 text-white ${isUrgent ? 'animate-pulse' : ''}`}
                  >
                    {countdown}
                  </span>
                )}
                <span className="text-sm text-text-muted font-[family-name:var(--font-jakarta)]">
                  {concert.genre}
                </span>
              </div>

              <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-text-primary mb-3">
                {concert.artist}
              </h1>
              <p
                className="font-[family-name:var(--font-cormorant)] text-2xl md:text-3xl mb-6"
                style={{ color: 'var(--accent)' }}
              >
                {concert.tourName}
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-text-muted mb-6">
                <div className="flex items-center gap-2">
                  <MapPin size={18} style={{ color: accentColor }} />
                  <span className="font-[family-name:var(--font-jakarta)]">
                    {concert.venue !== 'TBA' ? `${concert.venue}, ` : ''}{concert.city}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} style={{ color: accentColor }} />
                  <span className="font-[family-name:var(--font-jakarta)]">
                    {formatConcertDateLong(concert.date)}
                  </span>
                </div>
              </div>

              <p className="font-[family-name:var(--font-jakarta)] text-text-muted text-lg leading-relaxed max-w-3xl">
                {concert.description}
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap gap-4">
                {concert.ticketUrl && (
                  <a
                    href={concert.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex items-center gap-2 px-8 py-3 text-text-on-brand font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] transition-colors"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Ticket size={16} />
                    GET TICKETS
                    {concert.ticketPriceFrom ? ` · FROM ${formatPrice(concert.ticketPriceFrom)}` : ''}
                  </a>
                )}
                {hasMerch && (
                  <Link
                    href={`/artist/${concert.artistHandle}`}
                    className="inline-flex items-center gap-2 px-8 py-3 border border-border-strong text-text-muted font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-accent hover:text-accent transition-colors"
                  >
                    <ShoppingBag size={16} />
                    SHOP {concert.artist.toUpperCase()} MERCH
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />
        </div>
      </section>

      {/* Show details */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {details.map((d) => (
            <div
              key={d.label}
              className="bg-surface-card border border-border-default p-5"
            >
              <d.icon size={18} style={{ color: accentColor }} className="mb-3" />
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-1">
                {d.label}
              </p>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary">
                {d.value}
              </p>
            </div>
          ))}
        </div>

        {concert.keySongs && concert.keySongs.length > 0 && (
          <div className="mt-4 bg-surface-card border border-border-default p-5">
            <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-text-muted mb-3 flex items-center gap-2">
              <Music size={14} style={{ color: accentColor }} /> EXPECT TO HEAR
            </p>
            <div className="flex flex-wrap gap-2">
              {concert.keySongs.map((song) => (
                <span
                  key={song}
                  className="px-3 py-1.5 bg-surface-raised border border-border-default text-sm text-text-secondary font-[family-name:var(--font-jakarta)]"
                >
                  {song}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* About the artist */}
      {artistBio && (
        <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
          <div className="bg-surface-card/50 border border-border-default p-8 md:p-12">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-4">
              About {concert.artist}
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted text-sm leading-relaxed max-w-3xl">
              {artistBio}
            </p>
          </div>
        </section>
      )}

      {/* Merch for this show */}
      {hasMerch ? (
        <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.3em] mb-2" style={{ color: accentColor }}>
                WEAR IT TO THE SHOW
              </p>
              <h2 className="font-[family-name:var(--font-playfair)] text-2xl md:text-3xl text-text-primary">
                Shop {concert.artist} merch
              </h2>
            </div>
            <Link
              href={`/artist/${concert.artistHandle}`}
              className="hidden sm:inline-flex items-center gap-1 text-accent font-[family-name:var(--font-bebas)] tracking-wider text-sm hover:underline"
            >
              VIEW ALL
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                handle={product.handle}
                title={product.title}
                artist={product.artist}
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                image={product.image}
                badge={product.badge}
                accentColor={product.accentColor}
                product={product.originalProduct}
              />
            ))}
          </div>
        </section>
      ) : (
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
                Whether you are planning to attend the show at{' '}
                {concert.venue !== 'TBA' ? `${concert.venue} in ` : ''}{concert.city}, wearing
                concert merchandise is the best way to show your love for {concert.artist}. Our
                designs are printed on premium-quality fabric, ensuring comfort and durability.
              </p>
              <p>
                Shop the complete {concert.artist} collection at YORD India with free shipping on orders above ₹1,999 and pan-India delivery. All products come with easy returns and exchanges.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Related Concerts */}
      {relatedConcerts.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-16">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-6">
            More {concert.artist} Concerts in India
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedConcerts.map((rc) => {
              const rcImage = getConcertImage(rc);
              return (
                <Link
                  key={rc.slug}
                  href={`/concerts/${rc.slug}`}
                  className="group flex gap-4 bg-surface-card border border-border-default p-4 hover:border-accent/40 transition-all"
                >
                  {rcImage && (
                    <div className="relative w-20 h-20 shrink-0 overflow-hidden">
                      <Image
                        src={rcImage}
                        alt={rc.artist}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-text-secondary group-hover:text-accent transition-colors truncate">
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
                          timeZone: 'Asia/Kolkata',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
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
