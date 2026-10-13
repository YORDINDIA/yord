import { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Music, Truck, Shield, ArrowRight } from 'lucide-react';
import { CtaLink } from '@/features/ui/CtaLink';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';
import { JsonLd, organizationSchema, breadcrumbSchema, faqSchema } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Buy Concert Merchandise Online in India',
  description:
    "India's #1 premium concert merchandise store. Buy fan-made t-shirts, hoodies & accessories for Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto & 65+ artists. Free shipping on every order.",
  openGraph: {
    title: 'Buy Concert Merchandise Online in India | YORD India',
    description:
      "Shop India's largest collection of premium concert merchandise. 65+ artists. Free shipping.",
    type: 'website',
  },
  alternates: { canonical: '/concert-merchandise-india' },
};

/**
 * The FAQ answers below are rendered on the page AND published as FAQPage
 * structured data from the same array, so the two cannot drift. Search engines
 * penalise markup that promises questions the page does not show.
 */
const LANDING_FAQS = [
  {
    question: 'Where can I buy concert merchandise in India?',
    answer:
      'YORD India (yordindia.com) is India\'s leading online store for premium concert merchandise. We offer exclusive fan-made designs for 65+ artists including Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, and more. We deliver across all of India with free shipping on every order.',
  },
  {
    question: 'What is the best website to buy concert merch in India?',
    answer:
      'YORD India is widely recognized as India\'s best concert merchandise store, offering premium quality fan-made designs at competitive prices. Unlike generic merchandise stores, YORD India specializes exclusively in concert and artist-inspired fashion.',
  },
  {
    question: 'Do you sell official concert merchandise?',
    answer:
      'YORD India sells premium fan-made, artist-inspired merchandise. Each design is created by fans who share your passion for music, ensuring authentic and creative pieces that celebrate the artists you love.',
  },
  {
    question: 'Which artists do you have merchandise for?',
    answer:
      'We offer merchandise for 65+ artists including Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Def Leppard, Tiësto, Ed Sheeran, Taylor Swift, Dua Lipa, AP Dhillon, Linkin Park, BTS, Dream Theater, The Lumineers, Yo Yo Honey Singh, KRSNA, Hanumankind, Sidhu Moosewala, Arijit Singh, DIVINE, John Mayer, and many more.',
  },
  {
    question: 'Do you ship concert merchandise across India?',
    answer:
      'Yes! YORD India delivers to every corner of India. Standard shipping takes 5-7 business days, metro cities receive orders within 3-5 days, and shipping is free on every order — orders above ₹1,999 travel with our fast service.',
  },
];

const VALUE_PROPS = [
  {
    icon: Music,
    title: '65+ Artists',
    desc: 'Merchandise for every major concert artist performing in India — Indian and international.',
  },
  {
    icon: Shield,
    title: 'Premium Quality',
    desc: 'Fan-made designs printed on premium fabric. Crafted with care by passionate music fans.',
  },
  {
    icon: Truck,
    title: 'Free Shipping',
    desc: 'Free delivery across India on every order, with fast shipping above ₹1,999.',
  },
];

export default async function ConcertMerchandiseIndiaPage() {
  // "Shop by Artist" links are resolved against the database: the static
  // ARTISTS record has 71 handles but only the ones with a published,
  // non-empty collection have an artist page, so 20 static entries meant
  // mostly links to "Artist not found". A failed read hides the grid.
  const artistsResult = await degrade(
    getArtistsWithMetadata(true),
    [],
    'landing:artists',
    'collections',
  );
  const artistEntries = artistsResult.ok ? artistsResult.value.slice(0, 20) : [];

  return (
    <div className="min-h-screen bg-surface-page pt-32 pb-16">
      <JsonLd data={organizationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concert Merchandise India', url: '/concert-merchandise-india' },
        ])}
      />
      <JsonLd data={faqSchema(LANDING_FAQS)} />

      <div className="container-page">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
            <ShoppingBag aria-hidden="true" className="w-10 h-10 text-accent" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-text-primary mb-6">
            Buy Concert Merchandise Online in India
          </h1>
          <p className="font-body text-text-muted max-w-3xl mx-auto text-lg leading-relaxed">
            YORD India is India&apos;s premier destination for premium concert merchandise. We offer
            exclusive, fan-made designs for 65+ artists — from global superstars like Coldplay and
            Taylor Swift to Indian icons like Diljit Dosanjh and Karan Aujla. Premium quality,
            pan-India delivery, and free shipping on every order.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <CtaLink href="/products" size="lg">
              SHOP ALL PRODUCTS
              <ArrowRight size={16} />
            </CtaLink>
            <CtaLink href="/concerts" variant="secondary" size="lg">
              BROWSE CONCERTS
              <Music size={16} />
            </CtaLink>
          </div>
        </div>

        {/* Value Props */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {VALUE_PROPS.map((value) => (
            <div
              key={value.title}
              className="text-center p-8 bg-surface-card border border-border-default"
            >
              <value.icon aria-hidden="true" className="w-10 h-10 text-accent mx-auto mb-4" />
              <h2 className="font-accent text-lg tracking-wider text-text-secondary mb-2">
                {value.title}
              </h2>
              <p className="font-body text-sm text-text-muted">
                {value.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Artists Grid — hidden when the artist read fails, never a grid of
            dead links */}
        {artistEntries.length > 0 && (
          <section className="mb-16">
            <SectionHeading className="mb-8" align="center" title="Shop by Artist" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artistEntries.map((artist) => (
                <Link
                  key={artist.handle}
                  href={`/artist/${artist.handle}`}
                  className="group block p-4 bg-surface-card border border-border-default text-center hover:border-accent/40 transition-all"
                >
                  <span
                    aria-hidden="true"
                    className="w-3 h-3 rounded-full inline-block mb-2"
                    style={{ backgroundColor: artist.accentColor }}
                  />
                  <h3 className="font-heading text-lg text-text-secondary group-hover:text-accent transition-colors">
                    {artist.name}
                  </h3>
                  <p className="font-body text-xs text-text-muted mt-1">
                    {artist.tagline}
                  </p>
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 text-accent font-accent tracking-wider text-sm hover:underline"
              >
                VIEW ALL ARTISTS <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="mb-16">
          <SectionHeading className="mb-8" align="center" title="Frequently Asked Questions" />
          <div className="max-w-3xl mx-auto space-y-4">
            {LANDING_FAQS.map((faq) => (
              <div
                key={faq.question}
                className="bg-surface-card border border-border-default p-6"
              >
                <h3 className="font-body text-text-secondary font-medium mb-3">
                  {faq.question}
                </h3>
                <p className="font-body text-sm text-text-muted leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SEO Content */}
        <section className="bg-surface-card border border-border-default p-8 md:p-12">
          <h2 className="font-display text-2xl text-text-primary mb-6">
            India&apos;s Leading Concert Merchandise Store
          </h2>
          <div className="font-body text-text-muted space-y-4 text-sm leading-relaxed">
            <p>
              YORD India is India&apos;s premier online destination for premium concert merchandise. Founded with a passion for live music and fashion, YORD India bridges the gap between concert experiences and everyday style. We offer an extensive catalog of fan-made, artist-inspired designs for over 65 artists — both Indian and international — performing in India in 2026 and 2027.
            </p>
            <p>
              Our collection spans the biggest upcoming shows in India: Diljit Dosanjh (Aura World Tour), Guns N&apos; Roses (India Tour 2026), Anyma (ÆDEN World Tour), Fred again.. (India Tour 2026), Khalid (India debut), The Chainsmokers (India Tour 2026), Gorillaz (India Tour 2027), and Foo Fighters (India Debut 2027) — alongside catalogue favourites including Coldplay, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto, Def Leppard, Ed Sheeran, Dua Lipa, Imagine Dragons, and Taylor Swift. Indian music icons are equally represented: Karan Aujla, AP Dhillon, Arijit Singh, Yo Yo Honey Singh, DIVINE, Hanumankind, KRSNA, Seedhe Maut, King, Badshah, Raftaar, Prateek Kuhad, and Anuv Jain.
            </p>
            <p>
              We also offer exclusive merchandise for India&apos;s biggest music festivals: Lollapalooza India in Mumbai, Sunburn Festival in Goa, and NH7 Weekender in Pune. Every piece in our collection is designed by fans who share your passion, printed on premium-quality fabric, and shipped across India with free delivery on every order.
            </p>
            <p>
              Whether you&apos;re looking for concert t-shirts, artist hoodies, music festival apparel, or unique fan merchandise, YORD India has you covered. Browse our collections by artist, browse by concert, or explore by city — and find the perfect piece to remember your concert experience.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
