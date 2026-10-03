import type { Metadata } from 'next';
import { ARTISTS } from '@yord/db-types';
import {
  RAIL_HANDLES,
  type ArtistRail,
  getShowcaseArtists,
  loadArtistRail,
  loadConcerts,
  loadFeatured,
} from '@/features/concepts/loaders';
import { tanker } from '@/features/concepts/poster/fonts';
import { ArtistIndex } from '@/features/concepts/poster/ArtistIndex';
import { Concerts } from '@/features/concepts/poster/Concerts';
import { Curtain } from '@/features/concepts/poster/Curtain';
import { Hero } from '@/features/concepts/poster/Hero';
import { Marquee } from '@/features/concepts/poster/Marquee';
import { Masonry } from '@/features/concepts/poster/Masonry';
import { Newsletter } from '@/features/concepts/poster/Newsletter';
import { PosterRoot } from '@/features/concepts/poster/PosterRoot';
import { Rail } from '@/features/concepts/poster/Rails';
import { Story } from '@/features/concepts/poster/Story';
import { inkFor } from '@/features/concepts/poster/shared';
import type { SwatchData } from '@/features/concepts/poster/accent';
import '@/features/concepts/poster/poster.css';
import '@/features/concepts/poster/poster-sections.css';
import '@/features/concepts/poster/poster-closing.css';

export const revalidate = 3600;
export const metadata: Metadata = { title: 'Concept A Poster' };

const SWATCH_HANDLES = ['coldplay', 'diljit-dosanjh', 'karan-aujla', 'taylor-swift', 'alan-walker', 'billie-eilish'];
const STACK_HANDLES = ['coldplay', 'diljit-dosanjh', 'karan-aujla', 'honey-singh', 'taylor-swift'];
const MARQUEE_HANDLES = [
  'coldplay', 'taylor-swift', 'diljit-dosanjh', 'karan-aujla', 'honey-singh', 'the-weeknd',
  'ed-sheeran', 'dua-lipa', 'arijit-singh', 'ap-dhillon', 'billie-eilish', 'linkin-park',
  'imagine-dragons', 'justin-bieber',
];

const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

export default async function ConceptPosterPage() {
  const [featured, concerts, ...rails] = await Promise.all([
    settle(loadFeatured(8), null),
    settle(loadConcerts(), { shelves: [], now: 0 }),
    ...RAIL_HANDLES.map((h) => settle(loadArtistRail(h), null)),
  ]);

  const railList = rails.filter((r): r is ArtistRail => r !== null);

  const swatches: SwatchData[] = [
    { id: 'original', name: 'Original', color: 'var(--accent)', ink: 'var(--text-on-accent)' },
    ...SWATCH_HANDLES.flatMap((h) => {
      const a = ARTISTS[h];
      return a?.accentColor ? [{ id: h, name: a.name, color: a.accentColor, ink: inkFor(a.accentColor) }] : [];
    }),
  ];

  const stack = STACK_HANDLES.flatMap((h) => {
    const a = ARTISTS[h];
    return a?.heroImage ? [{ handle: h, name: a.name, image: a.heroImage }] : [];
  });

  const marquee = MARQUEE_HANDLES.flatMap((h) => (ARTISTS[h] ? [{ handle: h, name: ARTISTS[h].name }] : []));

  const index = getShowcaseArtists().map((a) => ({
    handle: a.handle,
    name: a.name,
    image: a.heroImage ?? '',
    color: a.accentColor || 'var(--accent)',
  }));

  return (
    <PosterRoot swatches={swatches} className={tanker.variable}>
      <Curtain />
      <Hero swatches={swatches} stack={stack} />
      <Marquee items={marquee} />
      <Masonry products={featured} swatches={swatches} />
      <Concerts shelves={concerts.shelves} now={concerts.now} />
      <ArtistIndex artists={index} />
      {railList.map((rail, i) => (
        <Rail key={rail.artist.handle} rail={rail} side={i % 2 === 0 ? 'left' : 'right'} />
      ))}
      <Story photo={ARTISTS.coldplay?.heroImage ?? '/artists/coldplay-hero.png'} />
      <Newsletter />
    </PosterRoot>
  );
}
