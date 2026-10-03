/**
 * Artist hero image precedence (`toArtistData` via `getArtistByHandle`).
 *
 * Owner decision: the designed local portrait (`ARTISTS[handle].heroImage`)
 * wins the full-bleed artist hero whenever one exists; the generated DB
 * covers (`storage_image_url`, `image_src`) are fallbacks, and a dead legacy
 * `image_src` must never shadow a candidate that can render. The Supabase
 * client is stubbed; the real module under test runs.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mock = vi.hoisted(() => ({ client: undefined as unknown }));

vi.mock('@/lib/supabase/server', () => ({
  createStaticClient: () => mock.client,
  createServerClient: async () => mock.client,
}));

import { getArtistByHandle } from '@/lib/supabase/queries';

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

interface Canned {
  data?: unknown;
  error?: unknown;
  count?: number;
}

function fakeClient(responses: Record<string, Canned>) {
  function builder(table: string) {
    const resolve = () =>
      Promise.resolve({
        data: responses[table]?.data ?? null,
        error: responses[table]?.error ?? null,
        count: responses[table]?.count ?? 0,
      });
    const self: Record<string, unknown> = {};
    for (const method of ['select', 'eq']) {
      self[method] = () => self;
    }
    self.single = () => resolve();
    self.then = (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
      resolve().then(onFulfilled, onRejected);
    return self;
  }
  mock.client = { from: (table: string) => builder(table) };
}

const COLLECTION_ROW = {
  id: 7,
  title: 'Coldplay',
  handle: 'coldplay',
  body_html: null,
  image_src: 'http://www.yordindia.com/cdn/shop/files/coldplay.png', // dead legacy URL
  storage_image_url: 'https://pub-abc123.r2.dev/collections/coldplay-generated.webp',
};

function stubCollection(row: Record<string, unknown>) {
  fakeClient({
    collections: { data: row },
    collects: { data: [{ product_id: 1 }], count: 1 },
  });
}

describe('artist hero precedence', () => {
  it('prefers the designed local portrait over both DB covers', async () => {
    stubCollection(COLLECTION_ROW);

    const artist = await getArtistByHandle('coldplay', true);

    expect(artist?.heroImage).toBe('/artists/coldplay-hero.png');
  });

  it('falls back to the generated storage cover when no static portrait exists', async () => {
    stubCollection({ ...COLLECTION_ROW, handle: 'not-in-static-record' });

    const artist = await getArtistByHandle('not-in-static-record', true);

    expect(artist?.heroImage).toBe('https://pub-abc123.r2.dev/collections/coldplay-generated.webp');
  });

  it('skips a dead legacy image_src and never returns it', async () => {
    stubCollection({ ...COLLECTION_ROW, handle: 'not-in-static-record', storage_image_url: null });

    const artist = await getArtistByHandle('not-in-static-record', true);

    expect(artist?.heroImage).toBeUndefined();
  });
});
