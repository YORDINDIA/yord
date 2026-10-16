import { ArrowRight, Music, Shield, Heart, Truck } from 'lucide-react';
import { CtaLink } from '@/features/ui/CtaLink';
import { SectionHeading } from '@/features/ui/SectionHeading';
import { JsonLd, organizationSchema, breadcrumbSchema } from '@/lib/seo/jsonld';

export const metadata = {
  title: 'About YORD India — India\'s Premium Concert Merchandise Store',
  description: 'YORD India is India\'s leading premium concert merchandise platform. Shop exclusive fan-made designs for 65+ artists. Learn about our mission, quality commitment, and pan-India delivery.',
  alternates: { canonical: '/about' },
};

const VALUES = [
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
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <JsonLd data={organizationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' },
        ])}
      />
      {/* Hero Section — `pt-32` is the app's clearance under the fixed header. */}
      <section className="relative pt-32 pb-20">
        <div className="container-page">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-accent text-sm tracking-[0.2em] text-accent mb-4">
                OUR STORY
              </p>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-text-primary mb-6">
                Where Music Meets Fashion
              </h1>
              <p className="font-body text-text-muted text-lg leading-relaxed mb-8">
                YORD India is India&apos;s premier destination for premium concert merchandise.
                We curate exclusive, fan-made designs inspired by the world&apos;s most iconic
                artists — from global superstars like Coldplay, Kanye West, Calvin Harris, and Linkin Park
                to Indian icons like Diljit Dosanjh, Karan Aujla, and Arijit Singh. With
                merchandise for over 65 artists and pan-India delivery, we bring the concert
                experience home to every music lover in India. We are an independent fan
                merchandise brand, not affiliated with or endorsed by any of the artists we
                celebrate.
              </p>
              <CtaLink href="/artists" size="lg">
                EXPLORE ARTISTS
                <ArrowRight size={16} />
              </CtaLink>
            </div>
            <div className="relative aspect-square bg-surface-card border border-border-default">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-12">
                  <div className="w-20 h-20 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
                    <Music aria-hidden="true" className="w-10 h-10 text-accent" />
                  </div>
                  <p className="font-display text-2xl text-text-secondary">
                    Celebrating the art of live performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-surface-card/50">
        <div className="container-page">
          <SectionHeading
            className="mb-16"
            align="center"
            eyebrow="WHY CHOOSE US"
            title="Our Commitment to You"
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="text-center p-8 bg-surface-card border border-border-default"
              >
                <div className="w-16 h-16 mx-auto mb-6 bg-accent-tint rounded-full flex items-center justify-center">
                  <value.icon aria-hidden="true" className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-3">
                  {value.title}
                </h3>
                <p className="font-body text-sm text-text-muted">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24">
        <div className="container-page">
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              className="mb-8"
              align="center"
              eyebrow="OUR MISSION"
              title="Bringing the Concert Experience Home"
            />
            <div className="space-y-6 font-body text-text-muted text-lg leading-relaxed">
              <p>
                We believe that music merchandise is more than just clothing — it&apos;s a
                connection to the moments that move us. Every t-shirt tells a story, every
                hoodie holds a memory, and every piece carries the energy of live performance.
              </p>
              <p>
                Our mission is to make artist-inspired merchandise accessible to every
                music lover in India, bringing fans closer to the artists they love.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-24">
        <div className="container-page">
          <div className="bg-gradient-to-r from-surface-card to-surface-raised border border-border-default p-12 md:p-16 text-center">
            <h2 className="font-display text-3xl md:text-4xl text-text-primary mb-4">
              Ready to Wear Your Passion?
            </h2>
            <p className="font-body text-text-muted max-w-lg mx-auto mb-8">
              Explore our collection of artist-inspired merchandise and find your perfect piece.
            </p>
            <CtaLink href="/" size="lg">
              SHOP NOW
              <ArrowRight size={16} />
            </CtaLink>
          </div>
        </div>
      </section>
    </div>
  );
}
