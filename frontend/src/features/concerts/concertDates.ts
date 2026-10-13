/* IST-safe day math for concert countdowns, so server and browser agree
   whatever their time zone. Same approach as the halftone concept section. */

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 19_800_000;

const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

/** Whole calendar days from `nowMs` until the show date (IST). Negative = past. */
export function getDaysUntil(dateStr: string, nowMs: number): number {
  return istDay(Date.parse(dateStr)) - istDay(nowMs);
}

export function getUrgencyLabel(days: number): string {
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

export interface ConcertUrgency {
  /** Whole days until the show; negative once it has passed. */
  days: number;
  /** Chip copy, or `null` when there is nothing honest to say. */
  label: string | null;
  /** Inside the week — the only case that earns the pulsing chip. */
  urgent: boolean;
}

/**
 * The countdown decision every concert surface makes. It was written out twice
 * (the card and the detail hero), which is how the two could disagree about
 * whether an `announced` show shows a countdown.
 *
 * An unconfirmed date gets the `ANNOUNCED` chip rather than "IN 40 DAYS": a
 * countdown to a rumoured date is a promise the listing cannot keep.
 */
export function getConcertUrgency(
  concert: { date: string; status: 'completed' | 'upcoming' | 'announced' },
  nowMs: number
): ConcertUrgency {
  const days = getDaysUntil(concert.date, nowMs);
  return {
    days,
    label: concert.status === 'announced' ? 'ANNOUNCED' : days < 0 ? null : getUrgencyLabel(days),
    urgent: concert.status === 'upcoming' && days >= 0 && days <= 7,
  };
}

export function formatConcertDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatConcertDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/** Compact month + year for tight lists ("Nov 2026"). IST-safe like the others. */
export function formatConcertMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
