/**
 * Everything the Diljit Aura quiz campaign can be tuned by, in one file: the
 * show it rides, the reward ladder, and the window the codes stay valid in.
 *
 * The percentages live here and nowhere else. They are deliberately *not*
 * `price_rules` rows: `price_rules.id` has no default and the admin mints ids
 * from `admin_next_id`, which `docs/deploy.md` applies *after* the migration
 * glob, so a migration that seeded three rules would have to invent ids and
 * could collide with the admin's counter. A five-day campaign with three fixed
 * tiers does not need a database round trip to know that 8 correct is 40% off.
 * The trade-off is explicit: changing a percentage is a deploy, not an admin
 * edit. `quiz_codes.percent` stores the number each code was minted with, so
 * codes already in shoppers' hands keep the value they were promised.
 */

/** The show the pop-up rides. Kept next to the tier table so both move together. */
export const CAMPAIGN = {
  artistName: 'Diljit Dosanjh',
  artistHandle: 'diljit-dosanjh',
  tourName: 'Aura India Tour',
  /** IST calendar date of the show (`concerts.ts` carries the same date). */
  concertDate: '2026-10-30',
  city: 'Delhi',
  venue: 'Jawaharlal Nehru Stadium',
  /** The concert page the pop-up links to. */
  concertUrl: '/concerts/diljit-dosanjh-aura-delhi-2026',
  /**
   * The tour poster the masthead band rides — a local public asset (~32 KB
   * webp), so it costs nothing to show on every quiz frame.
   */
  artUrl: '/concert-art/diljit-dosanjh-aura-delhi-2026.webp',
  /** The artist collection the reward CTA points at. */
  merchUrl: '/artist/diljit-dosanjh',
  /**
   * Last moment a code can be applied: 30 November 2026, 23:59:59 IST. The
   * India leg ends 5 December, so the tail gives a shopper who saw the Delhi
   * show a month to buy — and keeps the offer off the site before the next
   * campaign needs the same table.
   */
  endsAt: '2026-11-30T18:29:59.000Z',
} as const;

export type QuizTierId = 'bronze' | 'silver' | 'gold';

export interface QuizTier {
  id: QuizTierId;
  /** Shown on the result screen and in the admin table. */
  label: string;
  /** Discount applied to the cart total at checkout. */
  percent: number;
  /** Lowest correct-answer count that earns this tier. */
  minCorrect: number;
  /** Result-screen headline, in the tier's voice. */
  headline: string;
  /** One line under the headline. */
  blurb: string;
}

/**
 * The reward ladder, hardest tier first. `tierForScore` walks it in order and
 * takes the first rung the score clears, so the list must stay sorted by
 * descending `minCorrect` — `quiz.test.ts` asserts that rather than trusting it.
 */
export const QUIZ_TIERS: readonly QuizTier[] = [
  {
    id: 'gold',
    label: 'Gold',
    percent: 40,
    minCorrect: 8,
    headline: 'Oye, full marks energy.',
    blurb: 'You know your Diljit. Here is the biggest reward we give out.',
  },
  {
    id: 'silver',
    label: 'Silver',
    percent: 20,
    minCorrect: 5,
    headline: 'Solid fan. Real solid.',
    blurb: 'A good score. Take 20% off anything in the store.',
  },
  {
    id: 'bronze',
    label: 'Bronze',
    percent: 10,
    minCorrect: 0,
    headline: 'Everyone starts somewhere.',
    blurb: 'A little something for playing. The merch will teach you the rest.',
  },
] as const;

/** Every tier's percentage, for the pricing guard and the tests. */
export const QUIZ_PERCENTAGES: readonly number[] = QUIZ_TIERS.map((tier) => tier.percent);

/**
 * The tier a score earns. Total: `bronze` has `minCorrect: 0`, so the walk
 * always finds a rung and there is no "no reward" branch to forget to render.
 */
export function tierForScore(correct: number): QuizTier {
  const safe = Number.isFinite(correct) ? Math.max(0, Math.floor(correct)) : 0;
  return QUIZ_TIERS.find((tier) => safe >= tier.minCorrect) ?? QUIZ_TIERS[QUIZ_TIERS.length - 1];
}

/** True while codes can still be minted and redeemed. */
export function campaignIsOpen(now: number = Date.now()): boolean {
  return now <= Date.parse(CAMPAIGN.endsAt);
}

/** Human date for the "use it by" line, in IST so it matches the copy. */
export function campaignEndsLabel(): string {
  return new Date(CAMPAIGN.endsAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
