import type { QuizCode } from '@yord/db-types';

/**
 * The derived state of a quiz code — pure, and deliberately not in `lib/data/`.
 *
 * `lib/data/*` is the read layer: it talks to Supabase and is `server-only`.
 * This module is arithmetic over three fields and two clock readings, so it
 * lives beside the other pure helpers (`lib/collection-rules.ts`,
 * `lib/pagination.ts`) and is unit-tested directly.
 *
 * The page has to agree with what `peek_quiz_code` (migration 018) will decide
 * when the shopper next types the code in. A drift here is a support ticket: an
 * admin telling someone their code is fine while the checkout refuses it.
 */

/** Where a code sits in its life. */
export const QUIZ_CODE_STATUSES = ['available', 'held', 'redeemed', 'expired'] as const;
export type QuizCodeStatus = (typeof QUIZ_CODE_STATUSES)[number];

/** The tier filters the page offers, as strings because they arrive in a URL. */
export const QUIZ_TIER_FILTERS = ['10', '20', '40'] as const;

/**
 * The campaign's end, mirroring `CAMPAIGN.endsAt` in the storefront
 * (`frontend/src/features/quiz/config.ts`). Past this instant `peek_quiz_code`
 * refuses the code, so the admin labels it expired.
 */
export const campaignEndsAt = '2026-11-30T18:29:59.000Z';

/**
 * How long a Razorpay order may hold a code before the reservation goes stale.
 * Matches the `interval '15 minutes'` lease in `reserve_quiz_code` and `peek`.
 */
export const RESERVATION_LEASE_MS = 15 * 60 * 1000;

/** True once the campaign window has closed at `now`. */
export function campaignIsOver(now: number = Date.now(), endsAt: string = campaignEndsAt): boolean {
  const end = new Date(endsAt).getTime();
  return Number.isFinite(end) && now > end;
}

/**
 * Which state a row is in. The branch order mirrors `peek_quiz_code`: a spent
 * code is `redeemed` whatever else is true of it, and once the window has
 * closed nothing is `held` or `available` — the hold stops mattering.
 *
 * `held` is not an error state; it means a payment is mid-verify right now. It
 * is shown because a code stuck there *past* the lease is the one thing on this
 * page that needs a human, and a status that only ever read "available" would
 * hide it.
 */
export function quizCodeStatus(
  row: Pick<QuizCode, 'redeemed_at' | 'reserved_at'>,
  now: number = Date.now(),
  endsAt: string = campaignEndsAt,
): QuizCodeStatus {
  if (row.redeemed_at) return 'redeemed';
  if (campaignIsOver(now, endsAt)) return 'expired';
  const reserved = row.reserved_at ? new Date(row.reserved_at).getTime() : null;
  if (reserved !== null && Number.isFinite(reserved) && now - reserved < RESERVATION_LEASE_MS) {
    return 'held';
  }
  return 'available';
}
