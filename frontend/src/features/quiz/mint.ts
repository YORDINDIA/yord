import { MAX_DISCOUNT_PERCENT } from '@/lib/pricing';
import { QUIZ_QUESTION_COUNT } from './questions';
import { QUIZ_TIERS, tierForScore } from './config';
import type { QuizResult } from './quizStore';

/**
 * Reading the reply from `POST /api/quiz/complete`.
 *
 * Pulled out of `QuizRunner` because it is the one branch in the runner with
 * consequences — the difference between "here is your code", "this is over" and
 * "try again" — and the repo's test setup is node-only (no jsdom, no testing
 * library), so anything left inside a component cannot be tested at all. Here it
 * is a pure function of an unknown JSON body, and `quiz.test.ts` covers it.
 *
 * The rule the whole module exists to enforce: **a body that is not a code must
 * never be treated as one.** A missing code, a percent that is not a usable
 * whole number, or a body that is not an object all become `error`, and the
 * player is offered a retry rather than a discount line that disagrees with the
 * total. `percent` is display-only — `create-order` and `verify-payment` price
 * the cart from `quiz_codes.percent` in the database — so a bad value here
 * cannot overcharge anyone, but it can still put "NaN% off" in a cart.
 */

export const MINT_FAILURE_MESSAGE = 'Could not issue your code. Please try again.';

export type MintOutcome =
  | { kind: 'code'; result: QuizResult }
  | { kind: 'closed' }
  | { kind: 'error'; message: string };

const TIER_IDS = new Set<string>(QUIZ_TIERS.map((tier) => tier.id));

/**
 * @param input        The parsed response body. Anything at all — it is untrusted.
 * @param fallbackCorrect The client's own tally, used only if the server omits
 *                     its count. The server's number is authoritative and is
 *                     what picks the tier; this is a label fallback, never a
 *                     scoring one.
 */
export function readMintResponse(input: unknown, fallbackCorrect: number): MintOutcome {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { kind: 'error', message: MINT_FAILURE_MESSAGE };
  }
  const body = input as Record<string, unknown>;

  /*
   * Checked FIRST, before the code — and the order is the whole point.
   *
   * A 410 for a closed campaign carries `error` and `reason` and *no* `code`
   * field, so a code-first check reads it as a generic failure and sends the
   * player back to question ten to retry something that can never succeed. This
   * is the exact bug this ordering was written to fix; `quiz.test.ts` pins it.
   */
  if (body.reason === 'CAMPAIGN_CLOSED') return { kind: 'closed' };

  const code = typeof body.code === 'string' ? body.code.trim() : '';

  /*
   * `Number.isInteger` **on the raw value**, never on a `Number()` coercion.
   *
   * Two separate traps, and this line has to miss both:
   *
   * 1. `typeof NaN === 'number'` is true, so a bare typeof check accepts NaN —
   *    and `JSON.stringify(NaN)` is `null`, so it survives a round trip. It
   *    would reach the promo store, where `computeTotals` clamps it to 0 while
   *    the discount line renders it literally: a cart showing a discount its own
   *    total did not take.
   * 2. `Number()` coerces rather than validates. `Number(null)` is `0`,
   *    `Number('')` is `0`, `Number([])` is `0`, `Number('40')` is `40` — so
   *    wrapping the raw value in `Number()` lets a null or a string through as a
   *    perfectly plausible percent. `Number.isInteger` does not coerce, so
   *    checking the raw value rejects all of them.
   *
   * This also rejects `Infinity`, a fractional percent, and anything past the
   * ceiling pricing already enforces.
   *
   * Zero is accepted: the CHECK constraint only allows 10/20/40, so a 0 means
   * something upstream is wrong, but refusing a code the database actually
   * issued would lock a player out of a real row. Shape is validated here;
   * business rules are not.
   */
  const percent = body.percent;
  if (
    !code ||
    typeof percent !== 'number' ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > MAX_DISCOUNT_PERCENT
  ) {
    const message = typeof body.error === 'string' && body.error ? body.error : MINT_FAILURE_MESSAGE;
    return { kind: 'error', message };
  }

  const correct = Number.isInteger(body.correct) ? (body.correct as number) : fallbackCorrect;
  const total =
    Number.isInteger(body.total) && (body.total as number) > 0
      ? (body.total as number)
      : QUIZ_QUESTION_COUNT;

  /*
   * An unrecognised tier is *derived from the score* rather than defaulted to
   * bronze. The old inline `data.tier ?? 'bronze'` would have labelled a gold
   * winner's result screen "Bronze" if the field ever went missing — a wrong
   * label on the one screen whose whole job is to say what they won. `correct`
   * is checked above, so deriving from it is safe.
   */
  const tier =
    typeof body.tier === 'string' && TIER_IDS.has(body.tier)
      ? (body.tier as QuizResult['tier'])
      : tierForScore(correct).id;

  return { kind: 'code', result: { code, percent, correct, total, tier } };
}
