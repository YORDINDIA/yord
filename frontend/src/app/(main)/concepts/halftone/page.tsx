import type { Metadata } from 'next';
import { cn } from '@yord/ui';
import { RAIL_HANDLES, getShowcaseArtists, loadArtistRail, loadConcerts, loadFeatured } from '@/features/concepts/loaders';
import { boska, panchang } from '@/features/concepts/halftone/fonts';
import { ArtistsSection } from '@/features/concepts/halftone/ArtistsSection';
import { ConcertsSection } from '@/features/concepts/halftone/ConcertsSection';
import { DitherTear } from '@/features/concepts/halftone/DitherTear';
import { FeaturedSection } from '@/features/concepts/halftone/FeaturedSection';
import { Hero } from '@/features/concepts/halftone/Hero';
import { NewsletterSection } from '@/features/concepts/halftone/NewsletterSection';
import { RailsSection } from '@/features/concepts/halftone/RailsSection';
import { StorySection } from '@/features/concepts/halftone/StorySection';
import '@/features/concepts/halftone/halftone.css';

export const revalidate = 3600;

export const metadata: Metadata = { title: 'Concept B Halftone' };

/* A failed read degrades its own section, never the page. */
const settle = <T,>(p: Promise<T>) => p.catch(() => null);

export default async function ConceptHalftonePage() {
  const [featured, concerts, ...rails] = await Promise.all([
    settle(loadFeatured(8)),
    settle(loadConcerts()),
    ...RAIL_HANDLES.map((handle) => settle(loadArtistRail(handle))),
  ]);

  return (
    <main className={cn(boska.variable, panchang.variable, 'ht')}>
      <Hero />
      <DitherTear from="var(--ht-c-stage)" to="var(--ht-c-ink)" />
      <ArtistsSection artists={getShowcaseArtists()} />
      <DitherTear from="var(--ht-c-ink)" to="var(--ht-c-wash)" height={140} />
      <FeaturedSection products={featured} />
      <ConcertsSection shelves={concerts?.shelves ?? []} now={concerts?.now ?? 0} />
      <RailsSection rails={rails} />
      <DitherTear from="var(--ht-c-wash)" to="var(--ht-c-stage)" />
      <StorySection />
      <DitherTear from="var(--ht-c-stage)" to="var(--ht-c-ink)" />
      <NewsletterSection />
    </main>
  );
}
