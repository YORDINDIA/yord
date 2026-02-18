import { Suspense } from 'react';
import { HeroSection } from '@/components/home/HeroSection';
import { ArtistShowcase } from '@/components/home/ArtistShowcase';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { ArtistProductsSection } from '@/components/home/ArtistProductsSection';
import { UpcomingConcertsSection } from '@/components/home/UpcomingConcertsSection';
import { BrandStory } from '@/components/home/BrandStory';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { JsonLd, organizationSchema, websiteSchema } from '@/lib/seo/jsonld';

export const revalidate = 3600; // Revalidate every hour to keep upcoming concerts fresh

export default function HomePage() {
  return (
    <main>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      {/* Hero Section - Full viewport immersive experience */}
      <HeroSection />

      {/* Divider - Hero to Upcoming Concerts */}
      <SectionDivider variant="line" />

      {/* Shop for Upcoming Concerts — high visibility placement */}
      <Suspense fallback={<UpcomingConcertsSkeleton />}>
        <UpcomingConcertsSection />
      </Suspense>

      {/* Divider - Concerts to Artists */}
      <SectionDivider variant="ornament" />

      {/* Artist Showcase - Horizontal scroll of featured artists */}
      <ArtistShowcase />

      {/* Divider - Artists to Products */}
      <SectionDivider variant="ornament" />

      {/* Featured Products */}
      <Suspense fallback={<FeaturedProductsSkeleton />}>
        <FeaturedProducts />
      </Suspense>

      {/* Artist Product Sections */}
      <SectionDivider variant="line" />
      <Suspense fallback={<ArtistProductsSkeleton artistName="Karan Aujla" />}>
        <ArtistProductsSection artistHandle="karan-aujla" />
      </Suspense>

      <SectionDivider variant="line" />
      <Suspense fallback={<ArtistProductsSkeleton artistName="Diljit Dosanjh" />}>
        <ArtistProductsSection artistHandle="diljit-dosanjh" />
      </Suspense>

      <SectionDivider variant="line" />
      <Suspense fallback={<ArtistProductsSkeleton artistName="Honey Singh" />}>
        <ArtistProductsSection artistHandle="honey-singh" />
      </Suspense>

      <SectionDivider variant="line" />
      <Suspense fallback={<ArtistProductsSkeleton artistName="Coldplay" />}>
        <ArtistProductsSection artistHandle="coldplay" />
      </Suspense>

      {/* Divider - Products to Brand Story */}
      <SectionDivider variant="gradient" />

      {/* Brand Story */}
      <BrandStory />

      {/* Divider - Brand Story to Newsletter */}
      <SectionDivider variant="ornament" />

      {/* Newsletter */}
      <NewsletterSection />
    </main>
  );
}

function FeaturedProductsSkeleton() {
  return (
    <section className="py-24 bg-noir-950">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="h-8 w-48 bg-noir-800 animate-pulse mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="aspect-[3/4] bg-noir-800 animate-pulse" />
              <div className="h-4 w-20 bg-noir-800 animate-pulse" />
              <div className="h-6 w-full bg-noir-800 animate-pulse" />
              <div className="h-4 w-24 bg-noir-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtistProductsSkeleton({ }: { artistName: string }) {
  return (
    <section className="py-16 bg-noir-900 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="h-0.5 w-12 bg-noir-700 animate-pulse mb-4" />
          <div className="h-10 w-48 bg-noir-800 animate-pulse mb-2" />
          <div className="h-4 w-32 bg-noir-800 animate-pulse" />
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-6 px-6 lg:px-12 pb-4" style={{ width: 'max-content' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[260px] sm:w-[280px] space-y-4">
              <div className="aspect-[3/4] bg-noir-800 animate-pulse" />
              <div className="h-4 w-20 bg-noir-800 animate-pulse" />
              <div className="h-6 w-full bg-noir-800 animate-pulse" />
              <div className="h-4 w-24 bg-noir-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UpcomingConcertsSkeleton() {
  return (
    <section className="py-24 bg-noir-950">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="h-4 w-32 bg-noir-800 animate-pulse mb-3" />
        <div className="h-10 w-80 bg-noir-800 animate-pulse mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-noir-900 border border-noir-800 p-6 space-y-4">
              <div className="h-0.5 w-12 bg-noir-800 animate-pulse" />
              <div className="h-8 w-48 bg-noir-800 animate-pulse" />
              <div className="h-4 w-32 bg-noir-800 animate-pulse" />
              <div className="h-4 w-40 bg-noir-800 animate-pulse" />
              <div className="grid grid-cols-3 gap-3 mt-6">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="aspect-[3/4] bg-noir-800 animate-pulse" />
                ))}
              </div>
              <div className="h-10 w-full bg-noir-800 animate-pulse mt-4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
