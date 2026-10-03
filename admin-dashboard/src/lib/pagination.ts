import { MAX_SEARCH_LENGTH, PAGE_SIZE } from '@/lib/constants';

/**
 * Pagination + query-string helpers. Previously copy-pasted into
 * products/orders/customers as `PAGE_SIZE`, `from`/`to`, `totalPages`, and a
 * local `qs()`. One implementation, unit-tested in `src/lib/__tests__`.
 */

/** First value of a Next.js `searchParams` entry (`string | string[] | undefined`). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
 * Shared by every admin list search — products, orders, customers, blogs,
 * media, discounts, settings, inventory, collections and the global search —
 * so what it does to each character is the contract for all of them.
 *
 * Three groups:
 *
 *  - `(`, `)`, `,`, `"` are PostgREST filter syntax and `*` is PostgREST's
 *    alias for `%`. Stripped, because the callers interpolate the term
 *    unquoted into `.or("col.ilike.%term%")` and a hostile query string must
 *    not be able to reshape the filter or act as a wildcard.
 *  - `%` and `_` are PostgreSQL LIKE wildcards. They are escaped with a
 *    backslash (LIKE's escape character) instead of deleted, so a literal
 *    search for `t_shirt` still matches a stored `t_shirt` — deleting them
 *    turned `t_shirt` into `tshirt`, which can never match its own title.
 *    PostgREST passes the pattern through to PostgreSQL as a parameter, so
 *    the backslash escapes survive the trip.
 *  - `\` is the LIKE escape character itself, so it is doubled first; doing
 *    it first is what keeps a typed backslash literal instead of an escape.
 *
 * The length is clamped before escaping so a 10k-character query cannot
 * become a slow query; escaping at most doubles the clamped length.
 */
export function sanitizeSearch(value: unknown): string {
  if (typeof value !== 'string') return '';
  const stripped = value
    .replace(/[(),"*]/g, '')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
  // Escape order matters: the escape character itself first, then the
  // wildcards it protects.
  return stripped.replace(/\\/g, '\\\\').replace(/[%_]/g, (char) => `\\${char}`);
}

/**
 * Merge current query params with overrides, dropping empty values so URLs
 * stay readable (`?q=&page=2` becomes `?page=2`).
 *
 * The literal `all` is dropped only for filter keys (`status=all`,
 * `stock=all` mean "no filter"). A search for the literal word "all" is a
 * real query and must survive, or paging wipes the search.
 */
export function qs(
  basePath: string,
  current: Record<string, string | null | undefined>,
  overrides: Record<string, string | number | null | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value === undefined || value === null) continue;
    const asString = String(value);
    if (asString === '') continue;
    if (asString === 'all' && key !== 'q') continue;
    params.set(key, asString);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
