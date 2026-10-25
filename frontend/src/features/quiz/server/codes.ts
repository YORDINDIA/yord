import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@yord/db-types';
import { normalizeCode } from '../codes';
import { CAMPAIGN } from '../config';

/**
 * Server-side access to `quiz_codes`. Starts with `import 'server-only'`
 * because it reads and writes the code table with the service key.
 *
 * Every predicate lives in the `peek_quiz_code` / `reserve_quiz_code` SQL
 * functions (migration 018) rather than here, so the promo field's validate
 * route, `create-order` and `verify-payment` cannot drift into three slightly
 * different ideas of "usable code". This module only shapes the call and maps
 * the SQL's `reason` tokens to copy the UI can show.
 *
 * The campaign window is passed in from `CAMPAIGN.endsAt` on every call, so the
 * date lives in one TypeScript constant and never in the database.
 */

/** Machine tokens `peek_quiz_code` and `reserve_quiz_code` return. */
export type CodeRejectionReason = 'not_found' | 'redeemed' | 'expired' | 'held' | 'unavailable';

export interface CodeAccepted {
  ok: true;
  percent: number;
  correct: number;
  total: number;
}

export interface CodeRejected {
  ok: false;
  reason: CodeRejectionReason;
}

export type CodeLookup = CodeAccepted | CodeRejected;

/** Shopper-facing copy per rejection. One place, so all three routes agree. */
export const CODE_REJECTION_MESSAGE: Record<CodeRejectionReason, string> = {
  not_found: 'That code is not valid. Check the spelling and try again.',
  redeemed: 'That code has already been used.',
  expired: 'That code has expired.',
  // `held` means a checkout is mid-verify with this code, or an earlier attempt
  // reserved it and never finished. The hold lasts up to 15 minutes
  // (`reserve_quiz_code`'s lease), so the copy must not promise a minute — the
  // old wording sent a shopper back to a field that would still refuse them.
  held: 'That code is being used by a checkout in progress. Try again in a few minutes.',
  unavailable: 'Could not check that code. Please try again.',
};

type ServiceClient = SupabaseClient<Database>;

/**
 * Shape a `jsonb` reply from either function. A missing or malformed payload is
 * `unavailable`, never `ok: false, reason: 'not_found'` — telling a shopper
 * their valid code is invalid because a query failed is the wrong answer, and
 * the caller's fallback (charge full price, or refuse to redeem) is safer than
 * a wrong accusation.
 */
function readLookup(data: unknown): CodeLookup {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'unavailable' };
  const payload = data as Record<string, unknown>;

  if (payload.ok !== true) {
    const reason = payload.reason;
    if (reason === 'not_found' || reason === 'redeemed' || reason === 'expired' || reason === 'held') {
      return { ok: false, reason };
    }
    return { ok: false, reason: 'unavailable' };
  }

  const percent = Number(payload.percent);
  const correct = Number(payload.correct);
  const total = Number(payload.total);
  if (!Number.isInteger(percent) || !Number.isInteger(correct) || !Number.isInteger(total)) {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, percent, correct, total };
}

/** Read-only: what is this code worth, and may it be used right now? */
export async function peekCode(supabase: ServiceClient, code: string): Promise<CodeLookup> {
  const { data, error } = await supabase.rpc('peek_quiz_code', {
    p_code: normalizeCode(code),
    p_ends_at: CAMPAIGN.endsAt,
  });
  if (error) return { ok: false, reason: 'unavailable' };
  return readLookup(data);
}

/**
 * Compare-and-swap reservation. `reservation` is the Razorpay order id, which
 * is what makes a verify retry idempotent: the retry re-takes its own hold,
 * while a different payment finds the code `held` or `redeemed`.
 */
export async function reserveCode(
  supabase: ServiceClient,
  code: string,
  reservation: string
): Promise<CodeLookup> {
  const { data, error } = await supabase.rpc('reserve_quiz_code', {
    p_code: normalizeCode(code),
    p_reservation: reservation,
    p_ends_at: CAMPAIGN.endsAt,
  });
  if (error) return { ok: false, reason: 'unavailable' };
  return readLookup(data);
}

/**
 * Give a hold back early, after the payment that held the code was refunded.
 *
 * `release_quiz_code` is a CAS keyed on the reservation, so this is safe to
 * call speculatively from any refund path: a code already redeemed, or taken
 * over by a different payment once its lease went stale, is left untouched.
 * Returns whether the hold actually cleared; a `false` is logged by the caller,
 * never surfaced — the refund, not the hold, is the answer the shopper gets.
 */
export async function releaseCode(
  supabase: ServiceClient,
  code: string,
  reservation: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('release_quiz_code', {
    p_code: normalizeCode(code),
    p_reservation: reservation,
  });
  if (error) return false;
  return Boolean((data as { ok?: boolean } | null)?.ok);
}

/**
 * The code a completed order's discount bookkeeping should be reconciled
 * against, derived from the payment rather than the request body: a replay of
 * a discounted payment finds the row its Razorpay order id holds (or held —
 * the lookup works before and after redemption).
 */
export async function codeHeldByPayment(
  supabase: ServiceClient,
  reservation: string
): Promise<{ code: string; percent: number } | null> {
  const { data, error } = await supabase
    .from('quiz_codes')
    .select('code, percent')
    .eq('reserved_for', reservation)
    .maybeSingle();
  if (error || !data) return null;
  return { code: data.code, percent: data.percent };
}

/**
 * Stamp the code as spent against the order that used it.
 *
 * Guarded on `reserved_for = reservation`, so only the payment holding the code
 * can mark it redeemed — a different payment that somehow reached this point
 * writes nothing. Returns whether the row moved; a `false` here is logged, not
 * fatal: the order is already saved and the money is already taken, so failing
 * the response would cost the shopper a confirmation to fix a bookkeeping row.
 */
export async function redeemCode(
  supabase: ServiceClient,
  code: string,
  reservation: string,
  orderId: number,
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('quiz_codes')
    .update({
      redeemed_at: new Date().toISOString(),
      order_id: orderId,
      redeemed_email: email.toLowerCase().trim(),
    })
    .eq('code', normalizeCode(code))
    .eq('reserved_for', reservation)
    .is('redeemed_at', null)
    .select('id');

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}
