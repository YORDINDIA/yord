/**
 * Where and when the quiz may surface itself — as data and one pure function.
 *
 * Split out of `useQuizGate` so the route rules can be unit-tested: the vitest
 * environment is `node` with no DOM, so a hook that reads `window`,
 * `sessionStorage` and the clock cannot be exercised at all. The part worth
 * pinning is the route list, because "the pop-up must never appear where it
 * competes with a payment" is a rule that fails silently and expensively — and
 * because adding a route (this file's own `/quiz` entry, for one) is exactly the
 * change that would otherwise break it unnoticed.
 */

/**
 * Surfaces where a shopper is browsing for a show or an artist.
 *
 * **Both singular and plural are required, and that is not cosmetic.** The
 * storefront has `/artists` (the listing) *and* `/artist/[handle]` (one artist);
 * `/collections` (the listing) *and* `/collection/[handle]` (one collection).
 * Listing only the plurals — which is what this list did before there was a test
 * for it — meant the pop-up never appeared on `/artist/diljit-dosanjh`, the one
 * page most likely to be visited by someone who would enjoy a Diljit quiz. The
 * `useQuizGate` comment claimed that page was covered; nothing checked, and it
 * was not. `quiz.test.ts` now asserts both forms.
 *
 * `/` is an exact match rather than a prefix — as a prefix it would match every
 * route on the site and make the rest of this list meaningless.
 *
 * `/concert-merchandise-india` is deliberately absent: it is an ad landing page,
 * and a modal over a paid click costs more than the campaign earns there.
 */
export const ALLOWED_PREFIXES = [
  '/',
  '/concerts',
  '/artists',
  '/artist',
  '/collections',
  '/collection',
] as const;

/**
 * Exact paths that look allowed but must never carry a modal.
 *
 * A modal over a buy page or a payment form costs more than the campaign earns,
 * and the promo field in the cart already carries the reward for anyone who
 * played. `/quiz` is the newest entry and the clearest case: a pop-up offering
 * the quiz, on top of the quiz, is the purest example of a pop-up that costs
 * more than it earns.
 */
export const SUPPRESSED_PREFIXES = [
  '/product',
  '/cart',
  '/checkout',
  '/account',
  '/auth',
  '/track-order',
  '/search',
  '/quiz',
] as const;

/**
 * What surfaced the quiz, carried into `quiz_viewed`.
 *
 * `timer` and `scroll` are the pop-up's two triggers; `direct` is someone who
 * opened `/quiz` themselves — from a shared link, a bookmark, or by typing it.
 * Kept as one vocabulary so the funnel reads as one funnel whichever way the
 * visitor arrived.
 */
export type QuizTrigger = 'timer' | 'scroll' | 'direct';

/** Whether the pop-up is allowed on `pathname`. Suppression wins over allowance. */
export function pathAllows(pathname: string): boolean {
  if (SUPPRESSED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  return ALLOWED_PREFIXES.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
