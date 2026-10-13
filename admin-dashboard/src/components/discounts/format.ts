/**
 * Presentation helpers for discount rules.
 *
 * Pure and framework-free so the server-rendered list and the client-rendered
 * preview card format a rule the same way — "10%" in the table and "10 %" in the
 * preview is the kind of drift this module exists to prevent.
 */

/**
 * `₹` formatting per the repo rule (`Intl.NumberFormat('en-IN')`), with the
 * fraction digits the table wants: a whole-rupee rule reads "₹500", a paise
 * rule keeps "₹499.5". `@/lib/utils/format`'s `formatCurrency` always prints two
 * decimals, which is right for order totals and noisy for a coupon value.
 */
const MONEY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const MONTH_DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const COUNT = new Intl.NumberFormat('en-IN');

/** Thousands-separated count, for the stat strip. */
export function formatCount(value: number): string {
  return COUNT.format(Number.isFinite(value) ? value : 0);
}

/** Two decimals at most, so `10.00` formats as `10` and `12.345` as `12.35`. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The rule's value as an admin reads it: `10%` for a percentage,
 * `₹500` for a fixed amount (never the raw `10 percentage` the old table
 * printed). `—` for a value that is missing or not a number.
 */
export function formatDiscountValue(
  value: number | string | null | undefined,
  valueType: string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return valueType === 'percentage' ? `${round2(amount)}%` : MONEY.format(round2(amount));
}

/** A usable Date, or null for empty/invalid input. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The rule's window: `1 Sept → 30 Sept`, `1 Sept 2025 → 3 Jan 2026` when the
 * years differ, and `1 Sept 2025 → Open ended` for a rule with no end.
 *
 * The year is dropped for a same-year window because it is the same on both
 * sides and the column is narrow. `Always on` is the no-window-at-all case,
 * which is also what an empty new-discount form previews.
 */
export function formatWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string {
  const start = parseDate(startsAt);
  const end = parseDate(endsAt);

  if (!start && !end) return 'Always on';
  if (start && !end) return `${MONTH_DAY_YEAR.format(start)} → Open ended`;
  if (!start && end) return `Until ${MONTH_DAY_YEAR.format(end)}`;
  if (!start || !end) return 'Always on'; // Unreachable; keeps the types honest.

  const sameYear = start.getFullYear() === end.getFullYear();
  const format = sameYear ? MONTH_DAY : MONTH_DAY_YEAR;
  return `${format.format(start)} → ${format.format(end)}`;
}

/**
 * A coupon code derived from the title: uppercased, `[A-Z0-9_-]` only, runs of
 * separators collapsed, capped at the schema's 64 characters.
 *
 * Matches `discountSchema.code`'s character rule exactly, so the suggestion is
 * always submittable. A title with no Latin letters or digits suggests nothing
 * (empty string) rather than a code made of dashes, and the admin types one.
 */
export function suggestCode(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64);
}
