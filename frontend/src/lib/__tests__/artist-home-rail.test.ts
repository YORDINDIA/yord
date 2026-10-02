/**
 * `getTopProductsByArtistHandle` — the homepage artist rail / concert-surface
 * reader.
 *
 * The artist page resolves its handle without a published gate on purpose, but
 * this shared helper must not: it feeds the homepage rails, and a collection an
 * admin has taken down must not keep leaking products there just because its
 * `collects` rows still exist. The Supabase client is stubbed; the real module
 * under test runs.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mock = vi.hoisted(() => ({ client: undefined as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createStaticClient: () => mock.client,
  createServerClient: async () => mock.client,
}));

import { getTopProductsByArtistHandle } from '@/lib/supabase/queries';

// `queryOrThrow` short-circuits to null when Supabase looks unconfigured.
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
    tables: () => [...new Set(calls.map((c) => c.table))],
  };
}

const PRODUCT = { id: 11, title: 'Karan Aujla Tee', handle: 'karan-aujla-tee' };

describe('homepage artist rail', () => {
  it('asks for the published collection row', async () => {
    const fake = fakeClient({
      collections: { data: { id: 7 } },
      collects: { data: [{ product_id: 11 }] },
      products: { data: [PRODUCT], count: 1 },
    });

    await getTopProductsByArtistHandle('karan-aujla', 4, true);

    expect(fake.calls).toContainEqual({
      table: 'collections',
      method: 'eq',
      args: ['published', true],
    });
  });

  it('returns [] for an unpublished collection and never reads its collects rows', async () => {
    // The published predicate filters the row out, so the reader behaves as if
    // the handle does not exist — the products stay off the homepage even
    // though the collection's collects rows are still in the table.
    const fake = fakeClient({
      collections: { data: null },
      collects: { data: [{ product_id: 11 }] },
      products: { data: [PRODUCT], count: 1 },
    });

    await expect(getTopProductsByArtistHandle('diljit-dosanjh', 4, true)).resolves.toEqual([]);
    expect(fake.tables()).toEqual(['collections']);
  });

  it('still reads the products for a published collection', async () => {
    const fake = fakeClient({
      collections: { data: { id: 7 } },
      collects: { data: [{ product_id: 11 }] },
      products: { data: [PRODUCT], count: 1 },
    });

    await expect(getTopProductsByArtistHandle('honey-singh', 4, true)).resolves.toEqual([PRODUCT]);
    expect(fake.calls).toContainEqual({
      table: 'collects',
      method: 'eq',
      args: ['collection_id', 7],
    });
  });

  it('keeps a failed read a failure instead of degrading to []', async () => {
    fakeClient({ collections: { error: { code: '42501', message: 'permission denied' } } });
    await expect(getTopProductsByArtistHandle('coldplay', 4, true)).rejects.toThrowError(
      /Query failed/,
    );
  });
});
