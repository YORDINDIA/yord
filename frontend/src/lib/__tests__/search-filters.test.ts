// PostgREST escaping + /products URL builder tests.
import { describe, expect, it } from 'vitest';
import { buildSearchOrFilter, escapeLike, sanitizeOrPattern } from '@/lib/search';
import { buildFilterUrl } from '@/features/catalog/catalogUrl';

describe('sanitizeOrPattern', () => {
  it('escapes quotes, backslashes, and LIKE wildcards with a length cap', () => {
    expect(sanitizeOrPattern('a"b\\c%d_e')).toBe('a\\"b\\\\c\\%d\\_e');
    expect(sanitizeOrPattern('x'.repeat(200)).length).toBe(100);
  });

  it('caps the raw input before escaping, so no escape pair is ever split', () => {
    // Regression: the cap used to run AFTER escaping, so a 100-char input
    // ending in a backslash kept only one of its two escaped backslashes. That
    // lone backslash then escaped the `%` appended by buildSearchOrFilter, so
    // the trailing wildcard was lost and the query matched nothing.
    const trailingBackslash = 'a'.repeat(99) + '\\';
    const escaped = 'a'.repeat(99) + '\\\\';
    expect(sanitizeOrPattern(trailingBackslash)).toBe(escaped);
    expect(buildSearchOrFilter(trailingBackslash)).toBe(
      `title.ilike."%${escaped}%",vendor.ilike."%${escaped}%",tags.ilike."%${escaped}%"`
    );
    // The appended wildcard survives: the value ends `\\%"`, not `\%"`.
    expect(buildSearchOrFilter(trailingBackslash).endsWith('\\\\%"')).toBe(true);

    // 99 chars + two backslashes is 101 raw chars: the cap drops one whole
    // backslash, and the escaped output still ends with a complete pair.
    expect(sanitizeOrPattern('b'.repeat(99) + '\\\\')).toBe('b'.repeat(99) + '\\\\');
    // A backslash past the raw cap disappears entirely rather than leaving a
    // dangling escape at the cut.
    expect(sanitizeOrPattern('c'.repeat(150) + '\\')).toBe('c'.repeat(100));
  });
});

describe('buildSearchOrFilter', () => {
  it('builds a three-column ilike or() string', () => {
    expect(buildSearchOrFilter('coldplay')).toBe(
      'title.ilike."%coldplay%",vendor.ilike."%coldplay%",tags.ilike."%coldplay%"',
    );
  });

  it('neutralizes filter-breaking input', () => {
    const out = buildSearchOrFilter('a",b(c)%_');
    // The quote is backslash-escaped so it cannot terminate the value;
    // commas/parens stay literal inside the double-quoted value.
    expect(out).toContain('a\\",b(c)');
    expect(out).toContain('\\%');
    expect(out).toContain('\\_');
  });
});

describe('escapeLike', () => {
  it('escapes LIKE metacharacters only', () => {
    expect(escapeLike('100%_x\\y')).toBe('100\\%\\_x\\\\y');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('buildFilterUrl', () => {
  it('merges overrides, drops defaults, removes on null', () => {
    const base = { artist: 'Coldplay', type: 'Tees', sort: 'price-asc' };
    expect(buildFilterUrl(base, { sort: 'title' })).toBe(
      '/products?artist=Coldplay&type=Tees&sort=title',
    );
    expect(buildFilterUrl(base, { sort: 'newest' })).toBe(
      '/products?artist=Coldplay&type=Tees',
    );
    expect(buildFilterUrl(base, { artist: null })).toBe('/products?type=Tees&sort=price-asc');
    expect(buildFilterUrl({}, {})).toBe('/products');
  });
});
