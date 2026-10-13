import { describe, expect, it } from 'vitest';
import { AUTO_COLLECTION_HANDLES, fetchAutoCollectionPage, isAutoCollection, isGridListedCollection } from '@/lib/data/autoCollections';
import { catalogOrder } from '@/lib/product';
import { DatabaseError } from '@/lib/errors';

/**
 * Auto collections.
 *
 * `new-arrivals` and `all` are linked from the storefront header/footer, so
 * they must never be empty and must never go stale. Their membership is
 * computed from `products` instead of a `collects` list; these tests pin that
 * the query filters to active products, orders newest-first on `published_at`
 * (which `scripts/tidy_collections.py` backfills from `created_at`), and pages
 * with `range`.
 */

interface Recorded {
  table?: string;
  select?: string;
  filters: Array<[string, unknown]>;
  /** Every `.order()` clause in call order (the last one is the tie-break). */
  orders: Array<[string, { ascending?: boolean; nullsFirst?: boolean }]>;
  range?: [number, number];
}

/** The client shape `fetchAutoCollectionPage` accepts. */
type Client = Parameters<typeof fetchAutoCollectionPage>[0];

/**
 * Minimal PostgREST-builder stand-in: records the chain and resolves the
 * canned response at `.range()`, which is the only place the real builder is
 * awaited in this function.
 */
function fakeClient(response: { data?: unknown; error?: unknown; count?: number }) {
  const recorded: Recorded = { filters: [], orders: [] };
  const builder = {
    select(columns: string) {
      recorded.select = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      recorded.filters.push([column, value]);
      return builder;
    },
    order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
      recorded.orders.push([column, opts ?? {}]);
      return builder;
    },
    range(from: number, to: number) {
      recorded.range = [from, to];
      return Promise.resolve({
        data: response.data ?? [],
        error: response.error ?? null,
        count: response.count ?? 0,
      });
    },
  };
  const client = {
    from(table: string) {
      recorded.table = table;
      return builder;
    },
  };
  return { client: client as unknown as Client, recorded };
}

describe('isAutoCollection', () => {
  it('recognises the two computed handles', () => {
    expect(AUTO_COLLECTION_HANDLES).toEqual(['new-arrivals', 'all']);
    expect(isAutoCollection('new-arrivals')).toBe(true);
    expect(isAutoCollection('all')).toBe(true);
  });

  it('does not claim a curated collection', () => {
    expect(isAutoCollection('coldplay')).toBe(false);
    expect(isAutoCollection('bestsellers')).toBe(false);
    expect(isAutoCollection('')).toBe(false);
  });
});

describe('isGridListedCollection', () => {
  // The `/collections` grid lists curated collections only; the auto handles
  // stay reachable by URL, sitemap and nav (`AUTO_COLLECTION_HANDLES`).
  it('excludes the two auto handles from the grid', () => {
    expect(isGridListedCollection('new-arrivals')).toBe(false);
    expect(isGridListedCollection('all')).toBe(false);
  });

  it('keeps curated collections and tolerates a missing handle', () => {
    expect(isGridListedCollection('coldplay')).toBe(true);
    expect(isGridListedCollection('bestsellers')).toBe(true);
    expect(isGridListedCollection(null)).toBe(false);
    expect(isGridListedCollection(undefined)).toBe(false);
  });
});

describe('fetchAutoCollectionPage', () => {
  it('queries active products ordered by published_at, paged with range', async () => {
    const { client, recorded } = fakeClient({
      data: [{ id: 1, title: 'Coldplay Tee' }],
      count: 463,
    });

    const result = await fetchAutoCollectionPage(client, { page: 3, pageSize: 12 });

    expect(recorded.table).toBe('products');
    expect(recorded.filters).toContainEqual(['status', 'active']);
    expect(recorded.orders).toEqual([
      ['published_at', { ascending: false, nullsFirst: false }],
      // Without the tie-break, rows sharing a timestamp can repeat or skip
      // across pages (OFFSET paging over a non-total order).
      ['id', { ascending: false, nullsFirst: undefined }],
    ]);
    expect(recorded.range).toEqual([24, 35]);
    expect(result.count).toBe(463);
    expect(result.data).toHaveLength(1);
  });

  it('honours a price sort through min_price', async () => {
    const { client, recorded } = fakeClient({ data: [], count: 0 });
    await fetchAutoCollectionPage(client, { sort: 'price-asc' });
    expect(recorded.orders).toEqual([
      ['min_price', { ascending: true, nullsFirst: false }],
      ['id', { ascending: false, nullsFirst: undefined }],
    ]);
  });

  it('honours a title sort', async () => {
    const { client, recorded } = fakeClient({ data: [], count: 0 });
    await fetchAutoCollectionPage(client, { sort: 'title' });
    expect(recorded.orders).toEqual([
      ['title', { ascending: true, nullsFirst: undefined }],
      ['id', { ascending: false, nullsFirst: undefined }],
    ]);
  });

  it('orders every sort with the same total order the collects path uses', async () => {
    // Page 1 (SSR) of `all` and page 2+ (`GET /api/products`) must agree, and
    // `all`/`new-arrivals` must not order differently from a collects-backed
    // collection for the same ?sort=.
    for (const sort of ['newest', 'price-asc', 'price-desc', 'title'] as const) {
      const { client, recorded } = fakeClient({ data: [], count: 0 });
      await fetchAutoCollectionPage(client, { sort });
      expect(recorded.orders, `${sort} must end in the id tie-break`).toEqual(
        catalogOrder(sort).map((c) => [c.column, { ascending: c.ascending, nullsFirst: c.nullsFirst }]),
      );
    }
  });

  it('throws DatabaseError on a failed read instead of rendering an empty catalog', async () => {
    // An empty page and a broken query must not look the same: the page relies
    // on the throw to render its error boundary.
    const { client } = fakeClient({ error: { message: 'boom', code: '42P01' } });
    await expect(fetchAutoCollectionPage(client)).rejects.toBeInstanceOf(DatabaseError);
  });
});
