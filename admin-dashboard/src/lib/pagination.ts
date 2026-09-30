import { MAX_SEARCH_LENGTH, PAGE_SIZE } from '@/lib/constants';

/**
 * Pagination + query-string helpers. Previously copy-pasted into
 * products/orders/customers as `PAGE_SIZE`, `from`/`to`, `totalPages`, and a
 * local `qs()`. One implementation, unit-tested in `src/lib/__tests__`.
 */

/** 1-based page number, coerced to a positive integer. */
export function clampPage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** Inclusive [from, to] row window for PostgREST `.range()`. */
export function pageRange(
  page: number,
  pageSize: number = PAGE_SIZE,
): { from: number; to: number } {
  const safePage = clampPage(page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * Build a search term safe to interpolate into a PostgREST `.or()` filter.
 *
 * `%`, `(`, `)`, `,` and `"` are the characters PostgREST uses as filter
 * syntax. Stripping them keeps a hostile query string from changing the shape
 * of the filter, then clamp the length so a 10k-character query cannot become
 * a slow query.
 */
export function sanitizeSearch(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[%(),"]/g, '').trim().slice(0, MAX_SEARCH_LENGTH);
}

/**
 * Merge current query params with overrides, dropping empty values so URLs
 * stay readable (`?q=&page=2` becomes `?page=2`).
 */
export function qs(
  basePath: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value === undefined || value === null) continue;
    const asString = String(value);
    if (asString === '' || asString === 'all') continue;
    params.set(key, asString);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
