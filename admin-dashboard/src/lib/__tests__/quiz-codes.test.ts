import { describe, expect, it } from 'vitest';
import {
  QUIZ_CODE_STATUSES,
  campaignEndsAt,
  campaignIsOver,
  quizCodeStatus,
} from '@/lib/quiz-codes';

/**
 * The status the admin shows for a quiz code.
 *
 * It is derived, not stored: the same row reads differently as the clock moves,
 * and the page has to agree with what `peek_quiz_code` (migration 018) will
 * decide when the shopper next types the code in. A drift here is a support
 * ticket — an admin telling someone their code is fine while the checkout
 * refuses it.
 *
 * The three inputs are the redemption stamp, the reservation stamp, and the
 * campaign window, so the cases below are the four combinations plus both sides
 * of each boundary.
 */

const BEFORE_END = Date.parse(campaignEndsAt) - 60_000;
const AFTER_END = Date.parse(campaignEndsAt) + 60_000;

describe('quiz code status', () => {
  it('calls an unspent, unreserved code available', () => {
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: null }, BEFORE_END)).toBe('available');
  });

  it('calls a code inside its 15-minute lease held', () => {
    const now = BEFORE_END;
    const fresh = new Date(now - 60_000).toISOString();
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: fresh }, now)).toBe('held');
  });

  it('calls a code whose lease has run out available again', () => {
    // The lease is what stops a crashed verify from locking a code out forever,
    // so a stale hold must read as usable — exactly like the SQL does.
    const now = BEFORE_END;
    const stale = new Date(now - 16 * 60_000).toISOString();
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: stale }, now)).toBe('available');
    // Both sides of the 15-minute boundary.
    const justInside = new Date(now - 14 * 60_000 - 59_000).toISOString();
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: justInside }, now)).toBe('held');
  });

  it('calls a spent code redeemed whatever else is true of it', () => {
    const now = BEFORE_END;
    const redeemed = new Date(now - 3_600_000).toISOString();
    expect(quizCodeStatus({ redeemed_at: redeemed, reserved_at: null }, now)).toBe('redeemed');
    expect(
      quizCodeStatus({ redeemed_at: redeemed, reserved_at: new Date(now).toISOString() }, now),
    ).toBe('redeemed');
    // Even after the campaign window closes: a redeemed code stays redeemed.
    expect(
      quizCodeStatus({ redeemed_at: redeemed, reserved_at: null }, AFTER_END),
    ).toBe('redeemed');
  });

  it('calls every unspent code expired once the window closes', () => {
    // Not `held` or `available`: past `endsAt` the hold stops mattering, because
    // `peek_quiz_code` refuses the code before it ever reads the reservation.
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: null }, AFTER_END)).toBe('expired');
    expect(
      quizCodeStatus({ redeemed_at: null, reserved_at: new Date(AFTER_END).toISOString() }, AFTER_END),
    ).toBe('expired');
  });

  it('treats the closing instant itself as still open', () => {
    // `now() > p_ends_at` in the SQL, so equality is inside the window.
    const end = Date.parse(campaignEndsAt);
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: null }, end)).toBe('available');
    expect(quizCodeStatus({ redeemed_at: null, reserved_at: null }, end + 1)).toBe('expired');
    expect(campaignIsOver(end)).toBe(false);
    expect(campaignIsOver(end + 1)).toBe(true);
  });

  it('only ever returns a status the page can render', () => {
    const stamps = [null, new Date(BEFORE_END - 60_000).toISOString()];
    for (const redeemed of stamps) {
      for (const reserved of stamps) {
        for (const now of [BEFORE_END, AFTER_END]) {
          expect(QUIZ_CODE_STATUSES).toContain(quizCodeStatus({ redeemed_at: redeemed, reserved_at: reserved }, now));
        }
      }
    }
  });

  it('mirrors the storefront campaign window', () => {
    // The storefront's `CAMPAIGN.endsAt` is the source of truth; this constant
    // is a copy, and a copy that drifts shows "expired" for codes the checkout
    // still accepts. Pin the value and the IST calendar date it means.
    expect(campaignEndsAt).toBe('2026-11-30T18:29:59.000Z');
    expect(
      new Date(campaignEndsAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }),
    ).toBe('30 November 2026');
  });
});
