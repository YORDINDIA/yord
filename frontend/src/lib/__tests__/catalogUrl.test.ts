// Catalog URL state: the pure helpers the client filter provider and the
// static pages share. No DOM — the frontend suite is node-only by design.
import { describe, expect, it } from 'vitest';
import {
  buildFilterUrl,
  filtersFromSearch,
  hasActiveFilters,
  mergeFilters,
  searchFromFilters,
  type CatalogFilters,
} from '@/features/catalog/catalogUrl';

describe('searchFromFilters', () => {
  it('serializes facets in a stable key order', () => {
    expect(searchFromFilters({ size: 'M', artist: 'coldplay' })).toBe('?artist=coldplay&size=M');
  });

  it('omits the default sort, so the clean URL stays clean', () => {
    expect(searchFromFilters({ sort: 'newest' })).toBe('');
    expect(searchFromFilters({ sort: 'price-asc' })).toBe('?sort=price-asc');
  });

  it('returns an empty string when nothing is filtered', () => {
    expect(searchFromFilters({})).toBe('');
  });
});

describe('mergeFilters', () => {
  it('overrides one key and keeps the rest', () => {
    expect(mergeFilters({ artist: 'coldplay', size: 'M' }, { size: 'L' })).toEqual({
      artist: 'coldplay',
      size: 'L',
    });
  });

  it('removes a key when the override is null', () => {
    expect(mergeFilters({ artist: 'coldplay', size: 'M' }, { artist: null })).toEqual({ size: 'M' });
  });

  it('does not carry an override that is an empty string', () => {
    expect(mergeFilters({ size: 'M' }, { size: '' })).toEqual({});
  });
});

describe('buildFilterUrl', () => {
  it('joins the path and the query string', () => {
    expect(buildFilterUrl({ artist: 'coldplay' }, { size: 'M' }, '/products')).toBe(
      '/products?artist=coldplay&size=M'
    );
  });

  it('returns the bare path when every filter is cleared', () => {
    expect(buildFilterUrl({ artist: 'coldplay' }, { artist: null }, '/products')).toBe('/products');
  });

  it('defaults to /products', () => {
    expect(buildFilterUrl({}, { type: 'Hoodies' })).toBe('/products?type=Hoodies');
  });
});

describe('filtersFromSearch', () => {
  it('parses a leading-? search string', () => {
    expect(filtersFromSearch('?artist=coldplay&size=XL&price=1000-1999&stock=1&sort=price-asc')).toEqual({
      artist: 'coldplay',
      type: undefined,
      size: 'XL',
      price: '1000-1999',
      stock: '1',
      sort: 'price-asc',
    });
  });

  it('accepts a search string without the leading ?', () => {
    expect(filtersFromSearch('size=M').size).toBe('M');
  });

  it('drops values the API would reject, so the request cannot 400', () => {
    const parsed = filtersFromSearch('?price=0-99999&size=%3Cscript%3E&artist=Coldplay%20Live');
    expect(parsed.price).toBeUndefined();
    expect(parsed.size).toBeUndefined();
    // An artist is a collection handle; "Coldplay Live" is not one.
    expect(parsed.artist).toBeUndefined();
  });

  it('collapses sort=newest to undefined rather than storing the default', () => {
    expect(filtersFromSearch('?sort=newest').sort).toBeUndefined();
    expect(filtersFromSearch('?sort=nonsense').sort).toBeUndefined();
  });

  it('parses an empty string to no filters at all', () => {
    expect(filtersFromSearch('')).toEqual({
      artist: undefined,
      type: undefined,
      size: undefined,
      price: undefined,
      stock: undefined,
      sort: undefined,
    });
  });
});

describe('round trip', () => {
  const cases: CatalogFilters[] = [
    { artist: 'coldplay' },
    { size: 'M', price: '2000-2999' },
    { artist: 'diljit-dosanjh', type: 'Hoodies', size: 'XL', price: '3000-plus', stock: '1', sort: 'title' },
    {},
  ];

  it.each(cases)('search -> filters -> search is stable for %o', (filters) => {
    expect(filtersFromSearch(searchFromFilters(filters))).toEqual(filters);
  });
});

describe('hasActiveFilters', () => {
  it('is false for an empty state and for a sort-only state', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ sort: 'price-asc' })).toBe(false);
  });

  it('is true as soon as any facet narrows the list', () => {
    expect(hasActiveFilters({ size: 'M' })).toBe(true);
    expect(hasActiveFilters({ stock: '1' })).toBe(true);
  });
});
