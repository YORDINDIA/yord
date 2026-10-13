import type { ArtistData } from '@yord/db-types';

const PINNED_ARTIST_HANDLES = ['diljit-dosanjh'];

/** Move priority artists to the front without changing the remaining order. */
export function orderArtistsWithPinnedFirst(artists: ArtistData[]): ArtistData[] {
  const pinned = PINNED_ARTIST_HANDLES.flatMap((handle) =>
    artists.filter((artist) => artist.handle === handle),
  );

  return [
    ...pinned,
    ...artists.filter((artist) => !PINNED_ARTIST_HANDLES.includes(artist.handle)),
  ];
}
