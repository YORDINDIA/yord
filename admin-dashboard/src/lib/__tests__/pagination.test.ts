import { describe, expect, it } from 'vitest';
import {
  clampPage,
  firstParam,
  pageCount,
  pageRange,
  qs,
  sanitizeSearch,
} from '@/lib/pagination';
import { MAX_SEARCH_LENGTH, PAGE_SIZE } from '@/lib/constants';

/**
 * Pagination and query-string helpers.
 *
 * These replaced three private copies (`products/page.tsx`, `orders/page.tsx`,
 * `customers/page.tsx`), each with its own `PAGE_SIZE`, `from`/`to`, and
 * `q.replace(/[%(),"]/g, '')` search sanitizer. The copies drifted, and one of
 * them applied its sanitizer to a column the query did not actually expose.
 */
describe('firstParam', () => {
  it('returns a string as-is', () => {
    expect(firstParam('tee')).toBe('tee');
  });

  it('takes the first entry of a repeated param', () => {
    expect(firstParam(['a', 'b'])).toBe('a');
  });

  it('passes undefined through', () => {
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe('clampPage', () => {
  it('keeps a positive integer page', () => {
    expect(clampPage(3)).toBe(3);
    expect(clampPage('4')).toBe(4);
  });

  it('coerces anything below 1 to page 1', () => {
    // A hand-edited `?page=0` must not produce a negative `.range()` window.
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage('abc')).toBe(1);
    expect(clampPage(NaN)).toBe(1);
  });

  it('floors a fractional page', () => {
    expect(clampPage(2.9)).toBe(2);
  });
});

describe('pageRange', () => {
  it('returns an inclusive 0-based window', () => {
    expect(pageRange(1, 25)).toEqual({ from: 0, to: 24 });
    expect(pageRange(2, 25)).toEqual({ from: 25, to: 49 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });

  it('clamps the page the same way clampPage does', () => {
    expect(pageRange(0, 25)).toEqual({ from: 0, to: 24 });
    expect(pageRange(-1, 25)).toEqual({ from: 0, to: 24 });
  });

  it('defaults to the shared PAGE_SIZE', () => {
    expect(pageRange(1)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
  });
});

describe('pageCount', () => {
  it('rounds up and never returns zero pages', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(100, 25)).toBe(4);
  });

  it('treats a negative total as empty', () => {
    expect(pageCount(-10)).toBe(1);
  });
});

describe('sanitizeSearch', () => {
  it('strips PostgREST filter syntax so a query cannot reshape the filter', () => {
    // `%` is a wildcard, `(`/`)`, `,` and `"` are filter operators. Interpolated
    // raw into `.or()`, a query of `a),id.not.is.null` would change the filter.
    expect(sanitizeSearch('coldplay')).toBe('coldplay');
    expect(sanitizeSearch('100%')).toBe('100');
    expect(sanitizeSearch('a)or(b')).toBe('aorb');
    expect(sanitizeSearch('x,y')).toBe('xy');
    expect(sanitizeSearch('say "hi"')).toBe('say hi');
  });

  it('strips LIKE wildcards too, so the typed text matches itself', () => {
    // `_` and `*` are not filter grammar, but they are LIKE wildcards: `*` is
    // PostgREST's alias for `%` and a bare `_` matches any character (both
    // verified against the live endpoint). Left in, `t_shirt` matched `t-shirt`
    // and `tXshirt` — a silently wider result set, not an error.
    expect(sanitizeSearch('t_shirt')).toBe('tshirt');
    expect(sanitizeSearch('50*off')).toBe('50off');
    expect(sanitizeSearch('a_b*c')).toBe('abc');
  });

  it('strips a mixed query down to its literal text', () => {
    expect(sanitizeSearch('100%_x')).toBe('100x');
    expect(sanitizeSearch('a_b%c,d*e')).toBe('abcde');
    // Characters that are not PostgREST syntax or wildcards survive untouched.
    expect(sanitizeSearch('t-shirt 2025')).toBe('t-shirt 2025');
    expect(sanitizeSearch("honey singh's tour")).toBe("honey singh's tour");
  });

  it('collapses to empty when nothing survives', () => {
    expect(sanitizeSearch('%%%')).toBe('');
    expect(sanitizeSearch('   ')).toBe('');
    expect(sanitizeSearch('')).toBe('');
    expect(sanitizeSearch('_*')).toBe('');
  });

  it('ignores non-strings', () => {
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch(null)).toBe('');
    expect(sanitizeSearch(42)).toBe('');
    expect(sanitizeSearch({})).toBe('');
  });

  it('clamps length so a huge query cannot become a slow query', () => {
    expect(sanitizeSearch('a'.repeat(5_000))).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeSearch('  tshirt  ')).toBe('tshirt');
  });
});

describe('qs', () => {
  it('builds a path with merged params', () => {
    expect(qs('/products', { q: 'tee' }, { page: 2 })).toBe('/products?q=tee&page=2');
  });

  it('lets an override win over the current value', () => {
    // `current` holds URL strings; page numbers arrive through `overrides`.
    expect(qs('/products', { page: '3' }, { page: 2 })).toBe('/products?page=2');
  });

  it('drops empty and "all" values so URLs stay readable', () => {
    // `?q=&status=all&page=2` is noise; the filters mean "no filter".
    expect(qs('/products', { q: '', status: 'all' }, { page: 2 })).toBe('/products?page=2');
  });

  it('drops undefined and null', () => {
    expect(qs('/orders', { q: undefined, from: null })).toBe('/orders');
  });

  it('returns the bare path when nothing survives', () => {
    expect(qs('/orders', {})).toBe('/orders');
    expect(qs('/orders', { q: '' })).toBe('/orders');
  });

  it('emits page 1 and writes a custom page key', () => {
    // Pagination links rely on both: "Previous" from page 2 is `page=1`, and the
    // second table on a page paginates under its own key.
    expect(qs('/blogs', { q: 'x' }, { page: 1 })).toBe('/blogs?q=x&page=1');
    expect(qs('/blogs', {}, { articlePage: 2 })).toBe('/blogs?articlePage=2');
  });

  it('preserves other active filters across a page change', () => {
    // The old hand-rolled pager in customers/page.tsx rebuilt the URL as
    // `?q=...&page=N`, silently dropping every other filter the moment one was
    // added.
    expect(qs('/orders', { q: 'tee', financial: 'paid' }, { page: 3 })).toBe(
      '/orders?q=tee&financial=paid&page=3',
    );
  });
});
