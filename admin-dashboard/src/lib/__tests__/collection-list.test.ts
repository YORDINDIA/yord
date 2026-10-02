import { describe, expect, it } from 'vitest';
import {
  COLLECTION_SCAN_LIMIT,
  filterAndSortCollections,
  pageCollections,
  toCollectionRow,
  type CollectionListRow,
  type CollectionSeed,
} from '@/lib/collection-list';
import { PAGE_SIZE } from '@/lib/constants';

/**
 * Collections list shaping.
 *
 * Product counts come from `collects`, so the empty filter and "most products"
 * sort run in memory and page afterwards. These pin the two things that are
 * easy to get wrong and invisible in a screenshot: the filtered total reported
 * to the pager (not the page length), and tie-breaking by title so equal counts
 * cannot reshuffle between pages.
 */
function row(
  id: number,
  title: string,
  productCount: number,
  extra: Partial<CollectionSeed> = {},
): CollectionListRow {
  return toCollectionRow(
    {
      id,
      title,
      handle: `handle-${id}`,
      collection_type: 'custom',
      published: true,
      updated_at: '2026-01-01T00:00:00.000Z',
      ...extra,
    },
    productCount,
  );
}

describe('toCollectionRow', () => {
  it('flags the auto handles the storefront computes itself', () => {
    expect(row(1, 'New Arrivals', 0, { handle: 'new-arrivals' }).isAuto).toBe(true);
    expect(row(2, 'All', 0, { handle: 'all' }).isAuto).toBe(true);
    expect(row(3, 'Coldplay', 0, { handle: 'coldplay' }).isAuto).toBe(false);
    expect(row(4, 'No handle', 0, { handle: null }).isAuto).toBe(false);
  });
});

describe('filterAndSortCollections', () => {
  const rows = [row(1, 'Full', 12), row(2, 'Empty', 0), row(3, 'Small', 3), row(4, 'Also empty', 0)];

  it('filters to collections that hold products', () => {
    expect(filterAndSortCollections(rows, { hasProducts: 'yes' }).map((r) => r.id)).toEqual([1, 3]);
  });

  it('filters to empty collections', () => {
    expect(filterAndSortCollections(rows, { hasProducts: 'no' }).map((r) => r.id)).toEqual([2, 4]);
  });

  it('leaves the row set untouched for `all`', () => {
    expect(filterAndSortCollections(rows, { hasProducts: 'all' })).toHaveLength(4);
  });

  it('sorts by product count descending, ties broken by title', () => {
    const sorted = filterAndSortCollections([...rows, row(5, 'Another empty', 0)], {
      sort: 'products',
    });
    expect(sorted.map((r) => r.title)).toEqual([
      'Full',
      'Small',
      'Also empty',
      'Another empty',
      'Empty',
    ]);
  });

  it('combines the empty filter with the product-count sort', () => {
    const shaped = filterAndSortCollections(rows, { hasProducts: 'no', sort: 'products' });
    expect(shaped.map((r) => r.title)).toEqual(['Also empty', 'Empty']);
  });
});

describe('pageCollections', () => {
  const rows = Array.from({ length: PAGE_SIZE + 5 }, (_, index) =>
    row(index + 1, `Collection ${index + 1}`, index),
  );

  it('returns the filtered total as `count`, not the page length', () => {
    const page = pageCollections(rows, 1, PAGE_SIZE);
    expect(page.rows).toHaveLength(PAGE_SIZE);
    expect(page.count).toBe(PAGE_SIZE + 5);
  });

  it('pages the remainder', () => {
    const page = pageCollections(rows, 2, PAGE_SIZE);
    expect(page.rows.map((r) => r.id)).toEqual(rows.slice(PAGE_SIZE).map((r) => r.id));
    expect(page.page).toBe(2);
  });

  it('clamps a bad page number instead of throwing', () => {
    expect(pageCollections(rows, 0, PAGE_SIZE).page).toBe(1);
    expect(pageCollections(rows, Number.NaN, PAGE_SIZE).page).toBe(1);
  });

  it('returns an empty page past the end without changing the total', () => {
    const page = pageCollections(rows, 99, PAGE_SIZE);
    expect(page.rows).toEqual([]);
    expect(page.count).toBe(PAGE_SIZE + 5);
  });

  it('keeps the scan limit above the page size it guards', () => {
    // The limit exists so a pathological catalog cannot make the read
    // unbounded; it must never be the thing that shortens a normal page.
    expect(COLLECTION_SCAN_LIMIT).toBeGreaterThan(PAGE_SIZE * 10);
  });
});
