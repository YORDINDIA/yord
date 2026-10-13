import { formatCurrency } from './utils/format';

/**
 * Number/label formatting for the chart set. Pure and dependency-free so the
 * helpers can be unit-tested and called from a client chart without pulling in
 * React or a Supabase client.
 *
 * Two shapes exist on purpose:
 * - tooltips, legends, and hidden data tables show full values (`formatCurrency`)
 * - axes show compact values (`compactCurrency`), because a 44px axis cannot
 *   hold "₹1,50,00,000".
 */

/**
 * `Intl.NumberFormat` construction is the expensive half of formatting, and a
 * chart formats a tick per render. One instance per locale is cached for the
 * lifetime of the page.
 */
const compactFormatters = new Map<string, Intl.NumberFormat>();

function compactNumberFormatter(locale: string): Intl.NumberFormat {
  let formatter = compactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(locale, formatter);
  }
  return formatter;
}

function compactCurrencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = compactFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      // Currency defaults to two fraction digits, which turns an uncompacted
      // `₹450` into `₹450.00` and a compacted `₹1.2L` into `₹1.20L`.
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    compactFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * `1234` → `1.2K`, `120000` → `1.2L`, `15000000` → `1.5Cr`.
 *
 * The locale is `en-IN` on purpose: this is an Indian storefront admin, so the
 * lakh/crore ladder reads as money here in a way "120K" does not. Non-finite
 * input renders the em dash rather than "NaN".
 */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return compactNumberFormatter('en-IN').format(value);
}

/**
 * Compact money for axes: `₹1.2L`, `₹450`, `₹1.5Cr`.
 *
 * INR keeps the Indian ladder (lakh = 1e5, crore = 1e7); every other currency
 * falls back to western units (`$120K`), because `en-IN` would print `$1.2L`
 * for USD, which is worse than wrong — it looks right. Unknown currency codes
 * throw inside `Intl`, so the full `formatCurrency` form is the last resort.
 */
export function compactCurrency(value: number, currency = 'INR'): string {
  if (!Number.isFinite(value)) return '—';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  try {
    return compactCurrencyFormatter(locale, currency).format(value);
  } catch {
    return formatCurrency(value, currency);
  }
}

/**
 * `2024-10-12` → `12 Oct`. Day/Month only, for a dense X axis.
 *
 * Parsed by hand and formatted in UTC: `new Date('2024-10-12')` is midnight UTC
 * while `.toLocaleDateString()` renders in the viewer's zone, so a chart looked
 * at from IST would shift the label back a day. Anything that is not a
 * `YYYY-MM-DD` prefix is handed back untouched, and out-of-range parts are
 * rejected instead of being rolled over by the Date constructor.
 */
export function formatDayLabel(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return day;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (month < 1 || month > 12 || date < 1 || date > 31) return day;

  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface PercentDelta {
  /** Which way the number moved; drives the `.delta.up` / `.delta.down` badge. */
  direction: DeltaDirection;
  /** Unsigned magnitude, e.g. `12.4%` — the arrow in the badge carries the sign. */
  value: string;
}

/**
 * Change from `previous` to `current`, as a percentage.
 *
 * `previous === 0` is flat with an em dash: "up from nothing" is undefined and
 * rendering `Infinity%` or `+100%` would both be lies. Anything under 0.05% is
 * flat too, so a noisy metric does not flicker between up and down. The
 * denominator is `|previous|` so a metric moving from -100 to -50 reads as
 * "up", which is how a human reads a negative number getting less negative.
 */
export function percentDelta(current: number, previous: number): PercentDelta {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return { direction: 'flat', value: '—' };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const magnitude = Math.round(Math.abs(change) * 10) / 10;

  if (!Number.isFinite(change) || magnitude === 0) {
    return { direction: 'flat', value: '0.0%' };
  }

  return { direction: change > 0 ? 'up' : 'down', value: `${magnitude.toFixed(1)}%` };
}
