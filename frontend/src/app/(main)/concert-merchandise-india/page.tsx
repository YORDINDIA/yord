import { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, Music, Truck, Shield, ArrowRight } from 'lucide-react';
import { ARTISTS } from '@/types/database';
import { JsonLd, organizationSchema, breadcrumbSchema, faqSchema } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Buy Concert Merchandise Online in India | YORD India',
  description:
    "India's #1 premium concert merchandise store. Buy fan-made t-shirts, hoodies & accessories for Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, Tiësto & 65+ artists. Free shipping above ₹1,999.",
  openGraph: {
    title: 'Buy Concert Merchandise Online in India | YORD India',
    description:
      "Shop India's largest collection of premium concert merchandise. 65+ artists. Free shipping.",
    type: 'website',
  },
  alternates: { canonical: '/concert-merchandise-india' },
};

const LANDING_FAQS = [
  {
    question: 'Where can I buy concert merchandise in India?',
    answer:
      'YORD India (yordindia.com) is India\'s leading online store for premium concert merchandise. We offer exclusive fan-made designs for 65+ artists including Coldplay, Diljit Dosanjh, Karan Aujla, Kanye West, Calvin Harris, DJ Snake, Linkin Park, and more. We deliver across all of India with free shipping on orders above ₹1,999.',
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
      'Yes! YORD India delivers to every corner of India. Standard shipping takes 5-7 business days, metro cities receive orders within 3-5 days, and we offer free shipping on orders above ₹1,999.',
  },
];

export default function ConcertMerchandiseIndiaPage() {
  const artistEntries = Object.values(ARTISTS).slice(0, 20);

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <JsonLd data={organizationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Concert Merchandise India', url: '/concert-merchandise-india' },
        ])}
      />
      <JsonLd data={faqSchema(LANDING_FAQS)} />

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
            Buy Concert Merchandise Online in India
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-300 max-w-3xl mx-auto text-lg leading-relaxed">
            YORD India is India&apos;s premier destination for premium concert merchandise. We offer
            exclusive, fan-made designs for 50+ artists — from global superstars like Coldplay and
            Taylor Swift to Indian icons like Diljit Dosanjh and Karan Aujla. Premium quality,
            pan-India delivery, and free shipping above ₹1,999.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              SHOP ALL PRODUCTS <ArrowRight size={16} />
            </Link>
            <Link
              href="/concerts"
              className="inline-flex items-center gap-2 px-8 py-3 border border-ivory-400 text-ivory-300 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-gold-200 hover:text-gold-200 transition-colors"
            >
              BROWSE CONCERTS <Music size={16} />
            </Link>
          </div>
        </div>

        {/* Value Props */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Music,
              title: '50+ Artists',
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
              desc: 'Free delivery across India on orders above ₹1,999. Fast shipping to all metros.',
            },
          ].map((v) => (
            <div
              key={v.title}
              className="text-center p-8 bg-noir-900 border border-noir-800"
            >
              <v.icon className="w-10 h-10 text-gold-200 mx-auto mb-4" />
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-2">
                {v.title}
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                {v.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Artists Grid */}
        <section className="mb-16">
          <h2 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-8 text-center">
            Shop by Artist
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artistEntries.map((artist) => (
              <Link
                key={artist.handle}
                href={`/artist/${artist.handle}`}
                className="group block p-4 bg-noir-900 border border-noir-800 text-center hover:border-gold-200/40 transition-all"
              >
                <span
                  className="w-3 h-3 rounded-full inline-block mb-2"
                  style={{ backgroundColor: artist.accentColor }}
                />
                <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-ivory-100 group-hover:text-gold-200 transition-colors">
                  {artist.name}
                </h3>
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-400 mt-1">
                  {artist.tagline}
                </p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/artists"
              className="inline-flex items-center gap-2 text-gold-200 font-[family-name:var(--font-bebas)] tracking-wider text-sm hover:underline"
            >
              VIEW ALL ARTISTS <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {LANDING_FAQS.map((faq) => (
              <div
                key={faq.question}
                className="bg-noir-900 border border-noir-800 p-6"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-ivory-100 font-medium mb-3">
                  {faq.question}
                </h3>
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SEO Content */}
        <section className="bg-noir-900 border border-noir-800 p-8 md:p-12">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50 mb-6">
            India&apos;s Leading Concert Merchandise Store
          </h2>
          <div className="font-[family-name:var(--font-jakarta)] text-ivory-300 space-y-4 text-sm leading-relaxed">
            <p>
              YORD India is India&apos;s premier online destination for premium concert merchandise. Founded with a passion for live music and fashion, YORD India bridges the gap between concert experiences and everyday style. We offer an extensive catalog of fan-made, artist-inspired designs for over 65 artists — both Indian and international — who have performed or are performing in India in 2024, 2025, and 2026.
            </p>
            <p>
              Our collection spans global superstars including Coldplay (Music of the Spheres World Tour), Kanye West (India Debut 2026), Calvin Harris (India Debut 2026), DJ Snake (India Tour 2026), Linkin Park (Lollapalooza India 2026), Tiësto (India Tour 2026), Def Leppard (India Tour 2026), Dream Theater (40th Anniversary), The Lumineers (Automatic World Tour), John Mayer (India Solo Debut), Ed Sheeran, Dua Lipa, Bryan Adams, Green Day, Maroon 5, and Imagine Dragons. Indian music icons are equally represented: Diljit Dosanjh (Dil-Luminati Tour), Karan Aujla (P-Pop Culture World Tour 2026), AP Dhillon (The Brownprint Tour), Arijit Singh, Yo Yo Honey Singh, DIVINE, Hanumankind, KRSNA, Seedhe Maut, King, Badshah, Raftaar, Prateek Kuhad, and Anuv Jain.
            </p>
            <p>
              We also offer exclusive merchandise for India&apos;s biggest music festivals: Lollapalooza India in Mumbai, Sunburn Festival in Goa, and NH7 Weekender in Pune. Every piece in our collection is designed by fans who share your passion, printed on premium-quality fabric, and shipped across India with free delivery on orders above ₹1,999.
            </p>
            <p>
              Whether you&apos;re looking for concert t-shirts, artist hoodies, music festival apparel, or unique fan merchandise, YORD India has you covered. Browse our collections by artist, browse by concert, or explore by city — and find the perfect piece to remember your concert experience.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
