/**
 * `getProductsByCollectionHandle` — the one resolver behind both halves of a
 * collection page.
 *
 * The route is split: page 1 is SSR, pages 2+ come from `GET /api/products`.
 * Both call this function, so the invariants that must hold are:
 *
 *  1. An auto handle (`new-arrivals`/`all`) is answered from `products` and
 *     never from `collects` — the stored membership for those two is empty, so
 *     a `collects` lookup would return a full page 1 and an empty page 2.
 *  2. The published gate is the collection ROW, so an unpublished or missing
 *     handle resolves to `null` (the page calls `notFound()`) — including for
 *     auto handles.
 *  3. A collection's `sort_order` is the default order only when the caller
 *     passes no sort, and the resolved order is identical on the auto and
 *     collects paths.
 *
 * The Supabase client is stubbed; the real module under test runs.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { SortOption } from '@/lib/product';

const mock = vi.hoisted(() => ({ client: undefined as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createStaticClient: () => mock.client,
  createServerClient: async () => mock.client,
}));

import { getProductsByCollectionHandle } from '@/lib/supabase/queries';

// `queryOrThrow` short-circuits to null when Supabase looks unconfigured, which
// would make every test below pass through the "missing row → 404" path.
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

interface Canned {
  data?: unknown;
  error?: unknown;
  count?: number;
}

/**
 * Minimal PostgREST builder: every method records itself and returns the
 * builder, and the terminals (`maybeSingle`, `range`, `then`) resolve the
 * canned response for that table.
 */
function fakeClient(responses: Record<string, Canned>) {
  const calls: Call[] = [];

  function builder(table: string) {
    const response = {
      data: responses[table]?.data ?? null,
      error: responses[table]?.error ?? null,
      count: responses[table]?.count ?? 0,
    };
    const resolve = () => Promise.resolve(response);
    const self: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'order', 'neq', 'limit', 'not']) {
      self[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return self;
      };
    }
    self.range = (...args: unknown[]) => {
      calls.push({ table, method: 'range', args });
      return resolve();
    };
    self.maybeSingle = () => {
      calls.push({ table, method: 'maybeSingle', args: [] });
      return resolve();
    };
    self.then = (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected);
    return self;
  }

  mock.client = { from: (table: string) => builder(table) };
  return {
    calls,
    orderClauses: (table: string) =>
      calls
        .filter((c) => c.table === table && c.method === 'order')
        .map((c) => [c.args[0], c.args[1]] as const),
  };
}

const PRODUCT = { id: 1, title: 'Coldplay Tee', handle: 'coldplay-tee' };

describe('auto collections', () => {
  it('reads products directly and never queries collects', async () => {
    const fake = fakeClient({
      collections: { data: { id: 1, sort_order: null } },
      products: { data: [PRODUCT], count: 3 },
      // Any collects lookup returns nothing: that is the whole point — the
      // stored membership for `all`/`new-arrivals` is empty, so a page 2 built
      // from `collects` would come back empty while page 1 was full.
      collects: { data: [], count: 0 },
    });

    const result = await getProductsByCollectionHandle(
      'all',
      { page: 1, pageSize: 12 },
      { useStatic: true },
    );

    expect(fake.calls.some((c) => c.table === 'collects')).toBe(false);
    expect(result?.count).toBe(3);
    expect(result?.data).toEqual([PRODUCT]);
  });

  it.each(['new-arrivals', 'all'])('pages %s from the products table', async (handle) => {
    const fake = fakeClient({
      collections: { data: { id: 1, sort_order: null } },
      products: { data: [PRODUCT], count: 463 },
    });
    const result = await getProductsByCollectionHandle(handle, {}, { useStatic: true });
    expect(result?.count).toBe(463);
    expect(fake.calls.filter((c) => c.method === 'range').map((c) => c.args)).toEqual([[0, 11]]);
  });
});

describe('published gate', () => {
  it('returns null (→ 404) when no published collection owns the handle', async () => {
    const fake = fakeClient({ collections: { data: null }, products: { data: [PRODUCT], count: 1 }, collects: { data: [{ product_id: 1 }] } });
    await expect(
      getProductsByCollectionHandle('all', {}, { useStatic: true }),
    ).resolves.toBeNull();
    // The gate is the row, so nothing else is read for a 404.
    expect([...new Set(fake.calls.map((c) => c.table))]).toEqual(['collections']);
  });

  it('asks for published collections only by default', async () => {
    const fake = fakeClient({ collections: { data: null } });
    await getProductsByCollectionHandle('draft-collection', {}, { useStatic: true });
    expect(fake.calls).toContainEqual({
      table: 'collections',
      method: 'eq',
      args: ['published', true],
    });
  });

  it('skips the published gate for artist pages (publishedOnly: false)', async () => {
    const fake = fakeClient({ collections: { data: null } });
    await getProductsByCollectionHandle('coldplay', {}, { publishedOnly: false, useStatic: true });
    expect(fake.calls.some((c) => c.method === 'eq' && c.args[0] === 'published')).toBe(false);
  });

  it('degrades to null instead of throwing when the backend is unconfigured', async () => {
    const saved = process.env[URL_KEY];
    delete process.env[URL_KEY];
    fakeClient({ collections: { data: { id: 1, sort_order: null } } });
    try {
      await expect(getProductsByCollectionHandle('all', {}, { useStatic: true })).resolves.toBeNull();
    } finally {
      process.env[URL_KEY] = saved;
    }
  });
});

describe('sort precedence', () => {
  function ordersFor(handle: string, options: { sort?: SortOption }, responses: Record<string, Canned>) {
    const fake = fakeClient(responses);
    return getProductsByCollectionHandle(handle, options, { useStatic: true }).then(() => fake);
  }

  const collectedRows = {
    collections: { data: { id: 7, sort_order: null } },
    collects: { data: [{ product_id: 1 }, { product_id: 2 }] },
    products: { data: [PRODUCT], count: 2 },
  };

  it('applies the collection default when the caller passes no sort', async () => {
    const fake = await ordersFor('bestsellers', {}, {
      ...collectedRows,
      collections: { data: { id: 7, sort_order: 'price-asc' } },
    });
    expect(fake.orderClauses('products')).toEqual([
      ['min_price', { ascending: true, nullsFirst: false }],
      ['id', { ascending: false, nullsFirst: undefined }],
    ]);
  });

  it('lets an explicit sort override the collection default', async () => {
    const fake = await ordersFor('bestsellers', { sort: 'title' }, {
      ...collectedRows,
      collections: { data: { id: 7, sort_order: 'price-asc' } },
    });
    expect(fake.orderClauses('products')).toEqual([
      ['title', { ascending: true, nullsFirst: undefined }],
      ['id', { ascending: false, nullsFirst: undefined }],
    ]);
  });

  it('falls back to newest for a NULL or unknown sort_order', async () => {
    for (const sort_order of [null, '', 'featured']) {
      const fake = await ordersFor('bestsellers', {}, {
        ...collectedRows,
        collections: { data: { id: 7, sort_order } },
      });
      expect(fake.orderClauses('products')[0], String(sort_order)).toEqual([
        'published_at',
        { ascending: false, nullsFirst: false },
      ]);
    }
  });

  it('reads collects ids in position order and passes them through for manual', async () => {
    // `manual` is the picker's saved order: the collects query must ask the DB
    // to sort by `collects.position`, and the id list must reach the products
    // fetch in that order (`fetchProductsByIds` preserves its given order for
    // `manual` instead of re-sorting by a product field).
    const fake = await ordersFor('bestsellers', {}, {
      ...collectedRows,
      collections: { data: { id: 7, sort_order: 'manual' } },
      collects: { data: [{ product_id: 2, position: 2 }, { product_id: 1, position: 1 }] },
    });
    expect(fake.orderClauses('collects')).toContainEqual([
      'position',
      { ascending: true, nullsFirst: false },
    ]);
    const inCall = fake.calls.find((c) => c.table === 'products' && c.method === 'in');
    expect(inCall?.args).toEqual(['id', [2, 1]]);
  });

  it('orders the auto path and the collects path identically for every sort', async () => {
    for (const sort of ['newest', 'price-asc', 'price-desc', 'title'] as SortOption[]) {
      const auto = await ordersFor('all', { sort }, {
        collections: { data: { id: 1, sort_order: null } },
        products: { data: [PRODUCT], count: 463 },
      });
      const collected = await ordersFor('bestsellers', { sort }, collectedRows);
      expect(
        auto.orderClauses('products'),
        `${sort}: page 1 (auto) and page 2+ (collects) must page identically`,
      ).toEqual(collected.orderClauses('products'));
    }
  });

  it('applies the collection default on the auto path too', async () => {
    const fake = await ordersFor('new-arrivals', {}, {
      collections: { data: { id: 2, sort_order: 'price-desc' } },
      products: { data: [PRODUCT], count: 463 },
    });
    expect(fake.orderClauses('products')[0]).toEqual([
      'min_price',
      { ascending: false, nullsFirst: false },
    ]);
  });

  it('reads the collects ids for the collection it resolved', async () => {
    const fake = fakeClient({ ...collectedRows, collections: { data: { id: 7, sort_order: null } } });
    await getProductsByCollectionHandle('bestsellers', {}, { useStatic: true });
    expect(fake.calls).toContainEqual({
      table: 'collects',
      method: 'eq',
      args: ['collection_id', 7],
    });
  });
});
