import { describe, expect, it } from 'vitest';
import { COLLECTION_SORT_ORDERS, collectionSortOrderOptions } from '@/lib/constants';

/**
 * The "Default product order" select's option list.
 *
 * `manual` orders by `collects.position` — the picker's saved order — and auto
 * collections (`new-arrivals`, `all`) have no `collects` rows at all, so the
 * storefront degrades their `manual` to `newest` no matter what the row says.
 * The select must not offer an option whose saved value is silently ignored.
 */
describe('collectionSortOrderOptions', () => {
  it('offers every non-newest option for a regular collection', () => {
    expect(collectionSortOrderOptions(false)).toEqual([
      'price-asc',
      'price-desc',
      'title',
      'manual',
    ]);
  });

  it('hides manual for an auto handle, keeping the sorts the storefront honours', () => {
    expect(collectionSortOrderOptions(true)).toEqual(['price-asc', 'price-desc', 'title']);
  });

  it('never returns newest (the select renders it as the empty option)', () => {
    expect(collectionSortOrderOptions(false)).not.toContain('newest');
    expect(collectionSortOrderOptions(true)).not.toContain('newest');
    expect(COLLECTION_SORT_ORDERS).toContain('newest');
  });
});
