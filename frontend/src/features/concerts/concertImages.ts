import { ARTISTS } from '@yord/db-types';
import type { Concert } from '@/lib/data/concerts';

/**
 * Image for a concert surface: the per-concert artwork when the entry has
 * one, otherwise the artist hero shared across that artist's cards.
 */
export function getConcertImage(concert: Concert): string | undefined {
  return concert.image ?? ARTISTS[concert.artistHandle]?.heroImage;
}

/**
 * Credit for whichever image `getConcertImage` resolves: the concert's own
 * line (photo source + licence, or 'AI-generated artwork') or the artist's.
 */
export function getConcertImageCredit(concert: Concert): string | undefined {
  return concert.imageCredit ?? ARTISTS[concert.artistHandle]?.imageCredit;
}
