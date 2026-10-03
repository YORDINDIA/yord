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
