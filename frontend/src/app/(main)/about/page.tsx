import Link from 'next/link';
import { ArrowRight, Music, Shield, Heart, Truck } from 'lucide-react';
import { JsonLd, organizationSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

export const metadata = {
  title: 'About YORD India — India\'s Premium Concert Merchandise Store',
  description: 'YORD India is India\'s leading premium concert merchandise platform. Shop exclusive fan-made designs for 50+ artists. Learn about our mission, quality commitment, and pan-India delivery.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-noir-950">
      <JsonLd data={organizationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' },
        ])}
      />
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-gold-200 mb-4">
                OUR STORY
              </p>
              <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl lg:text-6xl text-ivory-50 mb-6">
                Where Music Meets Fashion
              </h1>
              <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-lg leading-relaxed mb-8">
                YORD India is India&apos;s premier destination for premium concert merchandise.
                We curate exclusive, fan-made designs inspired by the world&apos;s most iconic
                artists — from global superstars like Coldplay, Kanye West, Calvin Harris, and Linkin Park
                to Indian icons like Diljit Dosanjh, Karan Aujla, and Arijit Singh. With
                merchandise for over 65 artists and pan-India delivery, we bring the concert
                experience home to every music lover in India.
              </p>
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
              >
                EXPLORE ARTISTS
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="relative aspect-square bg-noir-900 border border-noir-800">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-12">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
                    <Music className="w-10 h-10 text-gold-200" />
                  </div>
                  <p className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-100">
                    Celebrating the art of live performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="px-6 lg:px-12 py-24 bg-noir-900/50">
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-16">
            <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-gold-200 mb-4">
              WHY CHOOSE US
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50">
              Our Commitment to You
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Shield,
                title: 'Fan Made',
                description: 'Every piece is crafted with care by fans who share your passion for music.',
              },
              {
                icon: Heart,
                title: 'Premium Quality',
                description: 'We partner with manufacturers who share our commitment to exceptional craftsmanship.',
              },
              {
                icon: Truck,
                title: 'Pan-India Delivery',
                description: 'Fast, reliable shipping to every corner of India with careful packaging.',
              },
              {
                icon: Music,
                title: 'Exclusive Drops',
                description: 'Be first in line for limited edition releases and tour exclusives.',
              },
            ].map((value) => (
              <div
                key={value.title}
                className="text-center p-8 bg-noir-900 border border-noir-800"
              >
                <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
                  <value.icon className="w-8 h-8 text-gold-200" />
                </div>
                <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-3">
                  {value.title}
                </h3>
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="px-6 lg:px-12 py-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.2em] text-gold-200 mb-4">
              OUR MISSION
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-8">
              Bringing the Concert Experience Home
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-lg leading-relaxed mb-6">
              We believe that music merchandise is more than just clothing — it&apos;s a
              connection to the moments that move us. Every t-shirt tells a story, every
              hoodie holds a memory, and every piece carries the energy of live performance.
            </p>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-lg leading-relaxed">
              Our mission is to make artist-inspired merchandise accessible to every
              music lover in India, bringing fans closer to the artists they love.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 lg:px-12 pb-24">
        <div className="max-w-[1440px] mx-auto">
          <div className="bg-gradient-to-r from-noir-900 to-noir-800 border border-noir-700 p-12 md:p-16 text-center">
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-4">
              Ready to Wear Your Passion?
            </h2>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-lg mx-auto mb-8">
              Explore our collection of artist-inspired merchandise and find your perfect piece.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              SHOP NOW
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
