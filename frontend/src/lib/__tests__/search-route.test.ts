// The search route's error model. A failed read must not look like "no
// matches": the search page treats any non-ok response as an error (it renders
// ErrorState and never the empty copy), so the route has to answer 502 instead
// of `200 { products: [] }` when Supabase fails or the handler throws.
//
// The real route handler is imported; only the Supabase boundary and the
// logger are mocked, so a route that goes back to swallowing errors fails here.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    result: { data: [] as unknown, error: null as unknown },
    clientThrows: false,
    calls: 0,
  };
  const limit = vi.fn(async () => {
    state.calls += 1;
    return state.result;
  });
  const createStaticClient = vi.fn(() => {
    if (state.clientThrows) throw new Error('supabase unavailable');
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              order: () => ({ limit }),
            }),
          }),
        }),
      }),
    };
  });
  const logDbError = vi.fn();
  return { state, limit, createStaticClient, logDbError };
});

vi.mock('@/lib/logger', () => ({
  logDbError: h.logDbError,
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createStaticClient: h.createStaticClient }));

import { GET } from '@/app/api/search/route';

function request(url: string) {
  return { nextUrl: new URL(url) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.result = { data: [], error: null };
  h.state.clientThrows = false;
  h.state.calls = 0;
});

describe('GET /api/search', () => {
  it('answers 200 with the rows on a successful read', async () => {
    h.state.result = { data: [{ id: 1, title: 'Coldplay Tee' }], error: null };
    const res = await GET(request('http://localhost/api/search?q=coldplay'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ products: [{ id: 1, title: 'Coldplay Tee' }] });
  });

  it('answers 502 on a database error, never an empty result set', async () => {
    h.state.result = { data: null, error: { message: 'boom', code: 'PGRST500' } };
    const res = await GET(request('http://localhost/api/search?q=coldplay'));
    expect(res.status).toBe(502);
    expect(res.ok).toBe(false);
    const body = await res.json();
    expect(body.products).toBeUndefined();
    expect(body.error).toBe('Search unavailable');
    expect(h.logDbError).toHaveBeenCalledWith('search', h.state.result.error);
  });

  it('answers 502 when the handler throws', async () => {
    h.state.clientThrows = true;
    const res = await GET(request('http://localhost/api/search?q=coldplay'));
    expect(res.status).toBe(502);
    expect((await res.json()).products).toBeUndefined();
  });

  it('still answers 200 [] for a query too short to search', async () => {
    const res = await GET(request('http://localhost/api/search?q=a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ products: [] });
    expect(h.state.calls).toBe(0);
  });
});
