import type { Metadata } from 'next';
import { bevellier } from '@/features/concepts/stagelight/fonts';
import {
  RAIL_HANDLES,
  getShowcaseArtists,
  loadArtistRail,
  loadConcerts,
  loadFeatured,
} from '@/features/concepts/loaders';
import { Backstage } from '@/features/concepts/stagelight/Backstage';
import { Chapter } from '@/features/concepts/stagelight/Chapter';
import { Collection } from '@/features/concepts/stagelight/Collection';
import { Hero } from '@/features/concepts/stagelight/Hero';
import { Lineup, type LineupArtist } from '@/features/concepts/stagelight/Lineup';
import { Newsletter } from '@/features/concepts/stagelight/Newsletter';
import { Story } from '@/features/concepts/stagelight/Story';
import { Tonight } from '@/features/concepts/stagelight/Tonight';
import '@/features/concepts/stagelight/stagelight.css';
import '@/features/concepts/stagelight/hero.css';
import '@/features/concepts/stagelight/sections.css';
import '@/features/concepts/stagelight/story.css';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Concept C Stagelight' };

export default async function ConceptStagelightPage() {
  const [concerts, featured, ...rails] = await Promise.all([
    loadConcerts(),
    loadFeatured(8),
    ...RAIL_HANDLES.map((handle) => loadArtistRail(handle, 4)),
  ]);

  const artists: LineupArtist[] = getShowcaseArtists().flatMap((a) =>
    a.heroImage ? [{ handle: a.handle, name: a.name, tagline: a.tagline, image: a.heroImage }] : []
  );

  return (
    <main className={`${bevellier.variable} sl`}>
      <Hero />
      <Chapter n="02" title="Tonight" id="tonight" label="Upcoming concerts" tone="stage">
        <Tonight shelves={concerts.shelves} now={concerts.now} />
      </Chapter>
      <Chapter n="03" title="The Lineup" id="lineup" label="Featured artists" tone="stage" feather="out">
        <Lineup artists={artists} />
      </Chapter>
      <Chapter n="04" title="The Collection" id="collection" label="Featured collection" tone="surface" sweep="stage">
        <Collection products={featured} />
      </Chapter>
      <Chapter n="05" title="Backstage" id="backstage" label="Shop by artist" tone="surface">
        <Backstage rails={rails} />
      </Chapter>
      <Chapter n="06" title="The Story" id="story" label="Brand story and newsletter" tone="stage" feather="in">
        <Story />
        <Newsletter />
      </Chapter>
    </main>
  );
}
