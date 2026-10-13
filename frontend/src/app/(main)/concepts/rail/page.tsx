import type { Metadata } from 'next';
import { bespokeSlab } from '@/features/concepts/rail/fonts';
import { RAIL_HANDLES, loadArtistRail, loadConcerts, loadFeatured, type ArtistRail } from '@/features/concepts/loaders';
import { toPieces } from '@/features/concepts/rail/pieces';
import { RailHero } from '@/features/concepts/rail/RailHero';
import { TourTags } from '@/features/concepts/rail/TourTags';
import { ArtistRacks } from '@/features/concepts/rail/ArtistRacks';
import { Closing } from '@/features/concepts/rail/Closing';
import '@/features/concepts/rail/rail.css';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Concept D Rail',
  alternates: { canonical: '/concepts/rail' },
};

export default async function ConceptRailPage() {
  const [featured, concerts, ...rails] = await Promise.all([
    loadFeatured(8),
    loadConcerts(),
    ...RAIL_HANDLES.map((handle) => loadArtistRail(handle, 4)),
  ]);

  return (
    <div className={`${bespokeSlab.variable} rl`}>
      <RailHero pieces={toPieces(featured ?? [])} loadFailed={featured === null} />
      <TourTags shelves={concerts.shelves} />
      <ArtistRacks rails={rails.filter((r): r is ArtistRail => r !== null)} />
      <Closing />
    </div>
  );
}
