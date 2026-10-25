/**
 * The quiz clock's arithmetic, extracted so it can be tested: the frontend
 * suite is node-only, so logic that lives inside a component cannot be tested
 * at all (the same trade `mint.ts` and `gateRules.ts` make).
 *
 * Everything here is pure — the component owns the one impure part (reading
 * `Date.now()` inside the tick) and feeds both timestamps in.
 */

/** The clock reads as running out inside this window. Matches the a11y ping. */
export const URGENT_BELOW_SECONDS = 30;

/**
 * Seconds remaining on a quiz that started at `startedAt`. Rounded *up*, so
 * the label shows 0:00 exactly when time really is up rather than a beat
 * early, and clamped at 0 so a late tick can never report negative time.
 */
export function secondsLeft(startedAt: number, now: number, limitSeconds: number): number {
  const remaining = Math.ceil((startedAt + limitSeconds * 1000 - now) / 1000);
  return Number.isFinite(remaining) ? Math.max(0, Math.min(remaining, limitSeconds)) : limitSeconds;
}

/** `150 → "2:30"`, `47 → "0:47"`. A display label, never a duration source. */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `urgent` inside the final window: the display switches from accent to danger. */
export function timerUrgency(remaining: number): 'steady' | 'urgent' {
  return remaining <= URGENT_BELOW_SECONDS ? 'urgent' : 'steady';
}
