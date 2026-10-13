import type { ArtistRail } from '@/features/concepts/loaders';
import { BackstageRail } from './BackstageRail';

export function Backstage({ rails }: { rails: Array<ArtistRail | null> }) {
  const live = rails.filter((r): r is ArtistRail => r !== null && r.products.length > 0);
  return (
    <div className="sl-backstage">
      <h2 className="sr-only">Backstage: shop by artist</h2>
      {live.length === 0 ? (
        <p className="text-text-muted">Artist shelves are not loading right now. Reload in a moment.</p>
      ) : (
        <div className="sl-backstage__rails">
          {live.map((rail) => (
            <BackstageRail key={rail.artist.handle} rail={rail} />
          ))}
        </div>
      )}
    </div>
  );
}
