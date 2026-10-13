import { describe, expect, it } from 'vitest';
import type { ArtistData } from '@yord/db-types';
import { orderArtistsWithPinnedFirst } from './orderArtists';

function artist(handle: string): ArtistData {
  return { handle } as ArtistData;
}

describe('orderArtistsWithPinnedFirst', () => {
  it('puts Diljit first and preserves the order of other artists', () => {
    const artists = [artist('coldplay'), artist('diljit-dosanjh'), artist('taylor-swift')];

    expect(orderArtistsWithPinnedFirst(artists).map(({ handle }) => handle)).toEqual([
      'diljit-dosanjh',
      'coldplay',
      'taylor-swift',
    ]);
  });

  it('leaves the list unchanged when Diljit is absent and does not mutate the input', () => {
    const artists = [artist('coldplay'), artist('taylor-swift')];

    expect(orderArtistsWithPinnedFirst(artists)).toEqual(artists);
    expect(artists.map(({ handle }) => handle)).toEqual(['coldplay', 'taylor-swift']);
  });
});
