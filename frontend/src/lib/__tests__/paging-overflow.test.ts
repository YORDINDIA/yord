/**
 * Out-of-range `?page=` on every paged catalog path.
 *
 * PostgREST answers a `Range` whose offset is past the last row with HTTP 416
 * (`PGRST103`) rather than an empty page. Before this handling:
 * `/collection/all?page=40` (463 products) rendered its error boundary,
 * `/products?page=99` did too, and `GET /api/products?...&page=40` answered
 * 500. Each paged read now re-issues the identical query for one row to read
 * the total from its `count` header and answers with the empty page — and still
 * throws for every other failure, or for a 416 the total does not explain.
 *
 * `fetchAutoCollectionPage`/`fetchProductsByIds` take the client directly;
 * `getProductsFiltered` builds its own client, so its module is mocked.
 */
import { describe, expect, it, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { fetchAutoCollectionPage } from '@/lib/data/autoCollections';
import { fetchProductsByIds } from '@/lib/data/productsByIds';
import { DatabaseError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';

const mock = vi.hoisted(() => ({ client: undefined as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createStaticClient: () => mock.client,
  createServerClient: async () => mock.client,
}));

import { getProductsFiltered } from '@/lib/supabase/queries';

const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const PUBLISHABLE_KEY = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
let savedUrl: string | undefined;
let savedPublishable: string | undefined;
beforeAll(() => {
  savedUrl = process.env[URL_KEY];
  savedPublishable = process.env[PUBLISHABLE_KEY];
  process.env[URL_KEY] = 'http://localhost:54321';
  process.env[PUBLISHABLE_KEY] = 'test-key';
});
afterAll(() => {
  if (savedUrl === undefined) delete process.env[URL_KEY];
  else process.env[URL_KEY] = savedUrl;
  if (savedPublishable === undefined) delete process.env[PUBLISHABLE_KEY];
  else process.env[PUBLISHABLE_KEY] = savedPublishable;
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

const PAST_END = {
  code: 'PGRST103',
  message: 'Requested range not satisfiable',
  details: 'An offset of 468 was requested, but there are only 463 rows.',
};

/**
 * Mirrors PostgREST: the paged `range(from, to)` answers the canned response,
 * while the `range(0, 0)` count probe always answers with `probeCount` rows
 * reported — so a test can tell the two requests apart.
 */
function fakeClient(opts: {
  paged?: { data?: unknown; error?: unknown; count?: number };
  probeCount?: number;
}) {
  const calls: Call[] = [];

  function builder(table: string) {
    const self: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'ilike']) {
      self[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return self;
      };
    }
    self.range = (from: number, to: number) => {
      calls.push({ table, method: 'range', args: [from, to] });
      if (from === 0 && to === 0) {
        return Promise.resolve({ data: [], error: null, count: opts.probeCount ?? 0 });
      }
      return Promise.resolve({
        data: opts.paged?.data ?? null,
        error: opts.paged?.error ?? null,
        count: opts.paged?.count ?? 0,
      });
    };
    self.then = (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: opts.probeCount ?? 0 }).then(
        onFulfilled,
        onRejected,
      );
    return self;
  }

  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient;
  mock.client = client;
  return {
    client,
    calls,
    rangeArgs: () => calls.filter((c) => c.method === 'range').map((c) => c.args),
  };
}

describe('fetchAutoCollectionPage', () => {
  it('answers an out-of-range page with an empty page and the real total', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 463 });
    const result = await fetchAutoCollectionPage(fake.client, { page: 40, pageSize: 12 });
    expect(result).toEqual({ data: [], count: 463 });
    // Paged read, then the 0-0 count probe.
    expect(fake.rangeArgs()).toEqual([
      [468, 479],
      [0, 0],
    ]);
  });

  it('re-reads the total through the same active-products filter', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 463 });
    await fetchAutoCollectionPage(fake.client, { page: 40, pageSize: 12 });
    expect(fake.calls).toContainEqual({
      table: 'products',
      method: 'eq',
      args: ['status', 'active'],
    });
  });

  it('still throws for a failure that is not an out-of-range offset', async () => {
    const fake = fakeClient({ paged: { error: { code: '42P01', message: 'boom' } } });
    await expect(fetchAutoCollectionPage(fake.client, { page: 1 })).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('still throws when the total does not explain the 416 (guard, not a swallow)', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 1000 });
    await expect(fetchAutoCollectionPage(fake.client, { page: 40 })).rejects.toMatchObject({
      postgrestCode: 'PGRST103',
    });
  });

  it('returns an in-range page unchanged', async () => {
    const fake = fakeClient({ paged: { data: [{ id: 1 }], count: 463 } });
    const result = await fetchAutoCollectionPage(fake.client, { page: 2, pageSize: 12 });
    expect(result.count).toBe(463);
    expect(result.data).toEqual([{ id: 1 }]);
    expect(fake.rangeArgs()).toEqual([[12, 23]]);
  });
});

describe('fetchProductsByIds', () => {
  it('answers an out-of-range page with an empty page and the chunk total', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 105 });
    const result = await fetchProductsByIds(fake.client, [1, 2, 3], {
      sort: 'newest',
      page: 40,
      pageSize: 12,
    });
    expect(result).toEqual({ data: [], count: 105 });
  });

  it('counts only the ids in the chunk (the probe keeps the `in` filter)', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 105 });
    await fetchProductsByIds(fake.client, [1, 2, 3], { page: 40 });
    expect(fake.calls).toContainEqual({ table: 'products', method: 'in', args: ['id', [1, 2, 3]] });
  });

  it('still throws for a failure that is not an out-of-range offset', async () => {
    const fake = fakeClient({ paged: { error: { code: '42501', message: 'permission denied' } } });
    await expect(fetchProductsByIds(fake.client, [1], { page: 40 })).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('returns an in-range page unchanged', async () => {
    // Distinct `published_at` keeps the shared comparator's order identical to
    // the SQL order the fake returned (`newest` sorts on it, then id desc).
    const rows = [
      { id: 1, published_at: '2026-01-02T00:00:00Z' },
      { id: 2, published_at: '2026-01-01T00:00:00Z' },
    ];
    const fake = fakeClient({ paged: { data: rows, count: 105 } });
    const result = await fetchProductsByIds(fake.client, [1, 2], { page: 2, pageSize: 12 });
    expect(result).toEqual({ data: rows, count: 105 });
  });

  it('treats a 416 on the in-memory price sort as an empty chunk, not a failure', async () => {
    // Price sorts fetch from offset 0, so a 416 can only mean "no active
    // products in this id list": the page is empty, and the read must not throw.
    const fake = fakeClient({ paged: { error: PAST_END } });
    const result = await fetchProductsByIds(fake.client, [1, 2, 3], {
      sort: 'price-asc',
      page: 1,
    });
    expect(result).toEqual({ data: [], count: 0 });
  });

  it('still throws when the price-sort read fails for another reason', async () => {
    const fake = fakeClient({ paged: { error: { code: '42501', message: 'permission denied' } } });
    await expect(
      fetchProductsByIds(fake.client, [1], { sort: 'price-desc', page: 1 }),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('getProductsFiltered (/products)', () => {
  it('answers an out-of-range page instead of throwing', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 463 });
    const result = await getProductsFiltered({ page: 99, pageSize: 20 });
    expect(result).toEqual({ data: [], count: 463 });
    expect(fake.rangeArgs()).toEqual([
      [1960, 1979],
      [0, 0],
    ]);
  });

  it('keeps the filter on the count probe (the probe re-issues the same query)', async () => {
    const fake = fakeClient({ paged: { error: PAST_END }, probeCount: 105 });
    const result = await getProductsFiltered({ artist: 'coldplay', page: 99, pageSize: 20 });
    expect(result).toEqual({ data: [], count: 105 });
    expect(fake.calls).toContainEqual({
      table: 'products',
      method: 'ilike',
      args: ['vendor', '%coldplay%'],
    });
  });

  it('still throws for a failure that is not an out-of-range offset', async () => {
    fakeClient({ paged: { error: { code: '42501', message: 'permission denied' } } });
    await expect(getProductsFiltered({ page: 2 })).rejects.toBeInstanceOf(DatabaseError);
  });

  it('orders like every other catalog list (shared clause list + id tie-break)', async () => {
    const fake = fakeClient({ paged: { data: [], count: 0 } });
    await getProductsFiltered({ page: 1, sortBy: 'price-asc' });
    expect(fake.calls.filter((c) => c.method === 'order')).toEqual([
      { table: 'products', method: 'order', args: ['min_price', { ascending: true, nullsFirst: false }] },
      { table: 'products', method: 'order', args: ['id', { ascending: false, nullsFirst: undefined }] },
    ]);
  });
});
