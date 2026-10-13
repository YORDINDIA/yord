// Catalog filters: URL parsing, size order, URL building and the SQL builder.
import { describe, expect, it } from 'vitest';
import {
  applyCatalogFilters,
  catalogSelect,
  isSizeLabel,
  parseCatalogFilters,
  sortSizes,
  type FilterableQuery,
} from '@/lib/catalogFilters';
import { PRODUCT_SELECT } from '@/lib/data/productsByIds';
import { buildFilterUrl } from '@/features/catalog/catalogUrl';

/** Records every builder call; returns itself like the PostgREST builder. */
interface Recorder extends FilterableQuery<Recorder> {
  calls: [string, ...unknown[]][];
}

function recorder(): Recorder {
  const calls: Recorder['calls'] = [];
  const q = { calls } as Recorder;
  for (const m of ['ilike', 'eq', 'gt', 'gte', 'lt'] as const) {
    (q as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return q;
    };
  }
  return q;
}

describe('parseCatalogFilters', () => {
  it('keeps valid values and drops the rest', () => {
    expect(
      parseCatalogFilters({ artist: ' coldplay ', type: 'Hoodies', size: 'XL', price: '1000-1999', stock: '1' })
    ).toEqual({ artist: 'coldplay', type: 'Hoodies', size: 'XL', price: '1000-1999', stock: true });
    // The artist is a collection handle; a vendor-style name is not one.
    expect(parseCatalogFilters({ size: '<script>', price: '0-99999', stock: 'yes', artist: 'Coldplay Live' })).toEqual({
      artist: undefined,
      type: undefined,
      size: undefined,
      price: undefined,
      stock: undefined,
    });
  });

  it('reads the first value of a repeated param', () => {
    expect(parseCatalogFilters({ size: ['M', 'L'] }).size).toBe('M');
  });
});

describe('isSizeLabel', () => {
  it('accepts apparel and numeric sizes, rejects colours and fits', () => {
    for (const s of ['XS', 'xs', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '5XL', 'XXS', '32', '48']) {
      expect(isSizeLabel(s), s).toBe(true);
    }
    for (const s of ['Black', 'White', 'oversize', 'REGULAR', 'Default Title', 'Free Size', '']) {
      expect(isSizeLabel(s), s).toBe(false);
    }
  });
});

describe('sortSizes', () => {
  it('orders apparel sizes, then the rest alphabetically, without duplicates', () => {
    expect(sortSizes(['XL', 'Free Size', 'S', '2XL', 'M', 'S', '32', 'xs'])).toEqual([
      'xs',
      'S',
      'M',
      'XL',
      '2XL',
      '32',
      'Free Size',
    ]);
  });
});

describe('buildFilterUrl (new keys)', () => {
  const base = { artist: 'coldplay', size: 'M', price: 'under-1000', stock: '1', sort: 'price-asc' };

  it('keeps every filter and drops the default sort', () => {
    expect(buildFilterUrl(base, {})).toBe(
      '/products?artist=coldplay&size=M&price=under-1000&stock=1&sort=price-asc'
    );
    expect(buildFilterUrl(base, { sort: 'newest', size: null, stock: null })).toBe(
      '/products?artist=coldplay&price=under-1000'
    );
  });

  it('builds against another path and never carries a page', () => {
    expect(buildFilterUrl({ size: 'L', page: '3' } as never, {}, '/collection/new-arrivals')).toBe(
      '/collection/new-arrivals?size=L'
    );
  });
});

describe('applyCatalogFilters', () => {
  it('filters artist by collection membership and type exactly, escaping LIKE', () => {
    const q = applyCatalogFilters(recorder(), { artist: 'coldplay', type: '100% Cotton' });
    expect(q.calls).toEqual([
      ['eq', 'artist_c.collections.handle', 'coldplay'],
      ['ilike', 'product_type', '100\\% Cotton'],
    ]);
    expect(catalogSelect({ artist: 'coldplay' })).toContain('artist_c:collects!inner(collections!inner(handle))');
  });

  it('bounds price on min_price with an exclusive upper edge', () => {
    expect(applyCatalogFilters(recorder(), { price: '1000-1999' }).calls).toEqual([
      ['gte', 'min_price', 1000],
      ['lt', 'min_price', 2000],
    ]);
    expect(applyCatalogFilters(recorder(), { price: 'under-1000' }).calls).toEqual([['lt', 'min_price', 1000]]);
    expect(applyCatalogFilters(recorder(), { price: '3000-plus' }).calls).toEqual([['gte', 'min_price', 3000]]);
  });

  it('filters size and stock through the aliased embed only when asked', () => {
    expect(applyCatalogFilters(recorder(), {}).calls).toEqual([]);
    expect(catalogSelect({})).toBe(PRODUCT_SELECT);

    expect(applyCatalogFilters(recorder(), { stock: true }).calls).toEqual([['gt', 'avail.inventory_quantity', 0]]);
    // A size means "this size in stock": both filters land on the same variant row.
    expect(applyCatalogFilters(recorder(), { size: 'M' }).calls).toEqual([
      ['gt', 'avail.inventory_quantity', 0],
      ['ilike', 'avail.option1', 'M'],
    ]);
    expect(catalogSelect({ size: 'M' })).toContain('avail:product_variants!inner(id)');
    // The regular embed is untouched, so cards still see every variant.
    expect(catalogSelect({ size: 'M' }).startsWith(PRODUCT_SELECT)).toBe(true);
  });
});
