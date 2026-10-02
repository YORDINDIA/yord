/**
 * Presentation helpers shared by the two customer screens.
 *
 * They live beside the components instead of in `@/lib/utils/format` because
 * only this domain needs a relative age label; absolute formatting
 * (`formatDate`, `formatCurrency`) still comes from the shared module.
 */

/** How a customer is named everywhere: full name, else email, else "Customer". */
export function customerName(customer: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const full = [customer.first_name, customer.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return full || customer.email?.trim() || 'Customer';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative age for a dense table cell — "just now", "12m ago",
 * "3d ago", "2mo ago". Tooltip text beside it comes from `formatTimestamp`.
 *
 * `now` is injectable so the label is deterministic under test; the pages pass
 * nothing and the server's clock is used.
 */
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return '—';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '—';

  const diff = now - time;
  // A timestamp slightly in the future (clock skew between the database and
  // this server) reads better as "just now" than as a negative age.
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;

  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.max(1, Math.floor(days / 365))}y ago`;
}

/** Full timestamp for a cell's `title` — the exact time behind a relative label. */
export function formatTimestamp(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * `customers.tags` is one comma-separated string (Shopify's shape); the form
 * edits it as text and the page shows the parsed chips. Trimmed and
 * de-duplicated case-insensitively, order preserved.
 */
export function tagList(tags: string | null | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const raw of tags.split(',')) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    parsed.push(tag);
  }
  return parsed;
}
