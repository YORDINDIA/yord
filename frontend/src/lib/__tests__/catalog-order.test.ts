/**
 * Catalog order + sort resolution.
 *
 * Two defects this pins down, both silent:
 *
 *  1. A non-total order. `published_at`, `title` and `min_price` all have tie
 *     groups in the real catalog (145 products at ₹900, 122 products sharing a
 *     title), and OFFSET paging over a non-total order lets Postgres repeat or
 *     skip rows between page requests. Every sort must therefore end in the
 *     `id desc` tie-break, and the auto-collection (SQL) path and the
 *     collects (chunked, JS-merged) path must use the same clause list.
 *  2. `resolveSort`. A collection's own `sort_order` is its default order only
 *     when the shopper passed no `?sort=`; passing `parseSortParam(raw)` from
 *     the page collapsed "no param" and "?sort=newest" into one value and made
 *     the admin's Default product order dead.
 */
import { describe, expect, it } from 'vitest';
import {
  catalogOrder,
  compareCatalogProducts,
  parseSortParam,
  resolveSort,
  type SortOption,
} from '@/lib/product';
import type { ProductWithDetails } from '@yord/db-types';

function row(over: Partial<ProductWithDetails> & { id: number }): ProductWithDetails {
  return {
    title: `Product ${over.id}`,
    published_at: null,
    min_price: null,
    ...over,
  } as unknown as ProductWithDetails;
}

describe('catalogOrder', () => {
  const SORTS: SortOption[] = ['newest', 'price-asc', 'price-desc', 'title'];

  it('maps every sort value the API and the UI accept', () => {
    expect(catalogOrder('newest').map((c) => c.column)).toEqual(['published_at', 'id']);
    expect(catalogOrder('price-asc').map((c) => c.column)).toEqual(['min_price', 'id']);
    expect(catalogOrder('price-desc').map((c) => c.column)).toEqual(['min_price', 'id']);
    expect(catalogOrder('title').map((c) => c.column)).toEqual(['title', 'id']);
  });

  it.each(SORTS)('%s ends in the id desc tie-break', (sort) => {
    const clauses = catalogOrder(sort);
    expect(clauses.at(-1)).toEqual({ column: 'id', ascending: false });
  });

  it('puts NULL published_at last on the DESC newest sort', () => {
    // Postgres defaults a DESC sort to NULLS FIRST, so an undated product
    // would otherwise lead "Newest" — the exact bug the tidy backfill hid.
    expect(catalogOrder('newest')[0]).toEqual({
      column: 'published_at',
      ascending: false,
      nullsFirst: false,
    });
    expect(catalogOrder('price-asc')[0].nullsFirst).toBe(false);
    expect(catalogOrder('price-desc')[0].nullsFirst).toBe(false);
  });

  it('only the price sorts order on min_price, ascending by direction', () => {
    expect(catalogOrder('price-asc')[0]).toMatchObject({ column: 'min_price', ascending: true });
    expect(catalogOrder('price-desc')[0]).toMatchObject({ column: 'min_price', ascending: false });
  });
});

describe('resolveSort', () => {
  it('uses the collection default when the shopper passed no ?sort=', () => {
    expect(resolveSort(undefined, 'price-asc')).toBe('price-asc');
    expect(resolveSort(undefined, 'title')).toBe('title');
  });

  it('falls back to newest when the collection default is NULL or unknown', () => {
    // Every collection row in production is NULL today, and NULL is what the
    // column held before the field existed. `manual` used to fall here too,
    // but it is now the admin picker-order default (see the admin-writable
    // test below), so only genuinely unknown values degrade to newest.
    expect(resolveSort(undefined, null)).toBe('newest');
    expect(resolveSort(undefined, undefined)).toBe('newest');
    expect(resolveSort(undefined, 'featured')).toBe('newest');
    expect(resolveSort(undefined, '')).toBe('newest');
  });

  it('lets ?sort= override the collection default', () => {
    expect(resolveSort('title', 'price-asc')).toBe('title');
    expect(resolveSort('newest', 'price-asc')).toBe('newest');
    expect(resolveSort('price-desc', 'title')).toBe('price-desc');
  });

  it('treats an unknown or empty ?sort= as newest, not as "no preference"', () => {
    expect(resolveSort('featured', 'price-asc')).toBe('newest');
    expect(resolveSort('', 'price-asc')).toBe('newest');
  });

  it('accepts exactly the values the admin can store', () => {
    const adminWritable = ['newest', 'price-asc', 'price-desc', 'title', 'manual'];
    for (const value of adminWritable) {
      expect(resolveSort(undefined, value)).toBe(value);
      expect(parseSortParam(value)).toBe(value);
    }
    // `manual` is a collection default (the picker order), not a shopper sort:
    // it is never in the storefront dropdown, but `?sort=manual` must still
    // round-trip so page 2+ requests the same order page 1 was seeded with.
    expect(resolveSort('manual', null)).toBe('manual');
  });
});

describe('compareCatalogProducts (the JS twin of catalogOrder)', () => {
  it('orders newest first and sinks a NULL published_at', () => {
    const older = row({ id: 1, published_at: '2025-01-01T00:00:00+00:00' });
    const newer = row({ id: 2, published_at: '2025-06-01T00:00:00+00:00' });
    const undated = row({ id: 3, published_at: null });
    const sorted = [undated, older, newer].sort((a, b) => compareCatalogProducts(a, b, 'newest'));
    expect(sorted.map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it('breaks published_at ties by id desc, the same way SQL does', () => {
    const ts = '2025-06-01T00:00:00+00:00';
    const rows = [row({ id: 10, published_at: ts }), row({ id: 30, published_at: ts }), row({ id: 20, published_at: ts })];
    expect(rows.sort((a, b) => compareCatalogProducts(a, b, 'newest')).map((r) => r.id)).toEqual([30, 20, 10]);
  });

  it('orders title alphabetically and ties by id desc', () => {
    const rows = [
      row({ id: 1, title: 'Zebra' }),
      row({ id: 2, title: 'Alpha' }),
      row({ id: 5, title: 'Alpha' }),
      row({ id: 3, title: 'middle' }),
    ];
    expect(rows.sort((a, b) => compareCatalogProducts(a, b, 'title')).map((r) => r.id)).toEqual([5, 2, 3, 1]);
  });

  it('orders price ascending/descending from min_price with id desc inside a tie', () => {
    const rows = [
      row({ id: 1, min_price: '1100.00' as unknown as number }),
      row({ id: 2, min_price: '900.00' as unknown as number }),
      row({ id: 3, min_price: '900.00' as unknown as number }),
      row({ id: 4, min_price: null }),
    ];
    const asc = [...rows].sort((a, b) => compareCatalogProducts(a, b, 'price-asc')).map((r) => r.id);
    const desc = [...rows].sort((a, b) => compareCatalogProducts(a, b, 'price-desc')).map((r) => r.id);
    // DECIMAL arrives from PostgREST as a string — '900.00' must sort below
    // '1100.00' numerically, and the un-backfilled row sinks last.
    expect(asc).toEqual([3, 2, 1, 4]);
    expect(desc).toEqual([1, 3, 2, 4]);
  });

  it('is a total order (a copy sorted twice gives the same ids)', () => {
    const ts = '2025-06-01T00:00:00+00:00';
    const rows = Array.from({ length: 24 }, (_, i) =>
      row({ id: i + 1, min_price: 900 as unknown as number, published_at: i % 3 === 0 ? null : ts, title: `T${i % 4}` }),
    );
    for (const sort of ['newest', 'price-asc', 'price-desc', 'title'] as SortOption[]) {
      const a = [...rows].sort((x, y) => compareCatalogProducts(x, y, sort)).map((r) => r.id);
      const b = [...rows].reverse().sort((x, y) => compareCatalogProducts(x, y, sort)).map((r) => r.id);
      expect(a, `${sort} must not depend on input order`).toEqual(b);
    }
  });
});
