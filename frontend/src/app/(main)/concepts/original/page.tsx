import { Fragment, Suspense } from 'react';
import { HeroSection } from '@/features/home/HeroSection';
import { ArtistShowcase } from '@/features/home/ArtistShowcase';
import { FeaturedProducts } from '@/features/home/FeaturedProducts';
import { ArtistProductsSection } from '@/features/home/ArtistProductsSection';
import { UpcomingConcertsSection } from '@/features/home/UpcomingConcertsSection';
import { BrandStory } from '@/features/home/BrandStory';
import { NewsletterSection } from '@/features/home/NewsletterSection';
import { SECTION_PADDING } from '@/features/home/section';
import { SectionDivider } from '@/features/ui/SectionDivider';
import { Container } from '@/features/ui/Container';
import { Skeleton } from '@/features/ui/Skeleton';
import { getArtistsWithMetadata } from '@/lib/supabase/queries';
import { degrade } from '@/lib/result';

export const revalidate = 3600; // Revalidate every hour to keep upcoming concerts fresh

// The previous home page, kept for comparison while Stagelight is live at `/`.
export const metadata = {
  title: 'Original home',
  alternates: { canonical: '/concepts/original' },
};

/**
 * Artist rails in display order — Diljit leads (owner direction).
 *
 * Data rather than four copies of the same Suspense block: the section is
 * identical for every handle, and the copy-paste version had already drifted
 * from its own fallback (which took an `artistName` prop it never read).
 */
const ARTIST_RAILS = ['diljit-dosanjh', 'karan-aujla', 'honey-singh', 'coldplay'] as const;

export default async function OriginalHomePage() {
  // Artist rail links are resolved against the database: only handles with a
  // published, non-empty collection become tiles, so no link can land on the
  // "Artist not found" page. Static (cookie-free) client keeps the route
  // prerenderable; a failed read hides the rail instead of failing the page.
  const artistsResult = await degrade(
    getArtistsWithMetadata(true),
    [],
    'home:artists',
    'collections',
  );
  const artists = artistsResult.ok ? artistsResult.value : [];

  return (
    <div>
      {/* Hero Section - Full viewport immersive experience */}
      <HeroSection />

      {/* Divider - Hero to Upcoming Concerts */}
      <SectionDivider variant="line" />

      {/* Shop for Upcoming Concerts — high visibility placement */}
      <Suspense fallback={<UpcomingConcertsFallback />}>
        <UpcomingConcertsSection />
      </Suspense>

      {/* Divider - Concerts to Artists */}
      <SectionDivider variant="ornament" />

      {/* Artist Showcase - Horizontal scroll of featured artists */}
      <ArtistShowcase artists={artists} />

      {/* Divider - Artists to Products */}
      <SectionDivider variant="ornament" />

      {/* Featured Products */}
      <Suspense fallback={<FeaturedProductsFallback />}>
        <FeaturedProducts />
      </Suspense>

      {/* Artist Product Sections — Diljit leads (owner direction) */}
      {ARTIST_RAILS.map((artistHandle) => (
        <Fragment key={artistHandle}>
          <SectionDivider variant="line" />
          <Suspense fallback={<ArtistRailFallback />}>
            <ArtistProductsSection artistHandle={artistHandle} />
          </Suspense>
        </Fragment>
      ))}

      {/* Divider - Products to Brand Story */}
      <SectionDivider variant="gradient" />

      {/* Brand Story */}
      <BrandStory />

      {/* Divider - Brand Story to Newsletter */}
      <SectionDivider variant="ornament" />

      {/* Newsletter */}
      <NewsletterSection />
    </div>
  );
}

/**
 * The Suspense fallbacks below stand in for their section's own layout — a
 * fallback that reflows differently from the content it replaces is a layout
 * shift, not a skeleton. Every pulse comes from `Skeleton`; only the frame
 * (section, container, grid) is written here, matching the real section.
 *
 * The grid overrides name every breakpoint the section grid uses. `cn` merges
 * with tailwind-merge, which only drops a variant the caller mentions: leaving
 * `md:` out would silently keep `md:grid-cols-3` from the primitive's default
 * (catalog) contract.
 */
function FeaturedProductsFallback() {
  return (
    <section className={`bg-surface-card ${SECTION_PADDING}`}>
      <Container>
        <Skeleton variant="text-block" className="mb-12 max-w-md" />
        <Skeleton
          variant="product-grid"
          count={4}
          className="grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
        />
      </Container>
    </section>
  );
}

function ArtistRailFallback() {
  return (
    <section className={`bg-surface-card overflow-hidden ${SECTION_PADDING}`}>
      <Container>
        <Skeleton variant="text-block" className="mb-8 max-w-xs" />
      </Container>
      {/* Matches the real rail's scroller: the primitive supplies the card
          width and gap, the caller the page gutters. */}
      <Skeleton variant="rail" count={4} className="px-6 lg:px-12 pb-4" />
    </section>
  );
}

function UpcomingConcertsFallback() {
  return (
    <section className={SECTION_PADDING}>
      <Container>
        <Skeleton variant="text-block" className="mb-12 max-w-md" />
        <Skeleton
          variant="product-grid"
          count={3}
          className="grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
        />
      </Container>
    </section>
  );
}
