import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revenueWindowStart } from '@/lib/data/analytics';
import { getEngagement } from '@/lib/data/traffic';

/**
 * The engagement data module behind the analytics page's behavioral section.
 *
 * `getEngagement` fans out to the 010 rollup RPCs through the service client
 * and then enriches every ranked product with title + cover. These tests stub
 * the Supabase boundary (the pattern from the collection action tests) and pin
 * the three silent-failure shapes: a PostgREST bigint sum arriving as a
 * string, an empty day missing from `page_views_by_day` (zero-fill must
 * replace it, like `revenue_by_day`), and an unknown product id falling back
 * to `Product #<id>` instead of rendering an empty row.
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ rpc: h.rpc, from: h.from }),
  createServerClient: () => ({ rpc: h.rpc, from: h.from }),
}));

/** A `YYYY-MM-DD` key inside the current window, so tests never pin a clock. */
function dayKey(offsetFromStart: number, days: number): string {
  const day = revenueWindowStart(days);
  day.setUTCDate(day.getUTCDate() + offsetFromStart);
  return day.toISOString().slice(0, 10);
}

/** PostgREST delivers numeric aggregates as strings; the module must coerce. */
function kpiPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      page_views: '120',
      unique_sids: '45',
      product_views: '30',
      add_to_carts: '9',
      wishlist_adds: '4',
      searches: '7',
      checkout_started: '3',
      order_completed: '2',
      order_value: '5997',
      ...overrides,
    },
    error: null,
  };
}

function stubRpcs(overrides: Record<string, { data: unknown; error?: null }> = {}) {
  const byDay = overrides.page_views_by_day?.data ?? [
    // Today-1 and today-3 only; today-2 is missing and must zero-fill.
    { day: '2026-10-02', views: '40', unique_sids: '20' },
    { day: '2026-09-30', views: '10', unique_sids: '5' },
  ];
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'analytics_kpis') return Promise.resolve(kpiPayload());
    if (fn === 'page_views_by_day') return Promise.resolve({ data: byDay, error: null });
    return Promise.resolve({ data: overrides[fn]?.data ?? [], error: null });
  });
}

function thenable(result: { data: unknown }) {
  const builder = {
    select: () => builder,
    in: () => builder,
    order: () => builder,
    then: (
      resolve: (value: { data: unknown; error: null; count: number }) => unknown,
    ) => Promise.resolve({ data: result.data, error: null, count: 0 }).then(resolve),
  };
  return builder;
}

beforeEach(() => {
  h.rpc.mockReset();
  h.from.mockReset();
  h.from.mockImplementation((table: string) => {
    if (table === 'products') {
      return thenable({ data: [{ id: 12, title: 'Coldplay Tee' }] });
    }
    return thenable({
      data: [{ product_id: 12, storage_url: 'https://r2.example/tee.webp', src: null, position: 0 }],
    });
  });
});

describe('getEngagement', () => {
  it('coerces string aggregates into numbers for both KPI windows', async () => {
    stubRpcs();
    const data = await getEngagement(14);

    expect(data.kpis.current.pageViews).toBe(120);
    expect(data.kpis.current.uniqueVisitors).toBe(45);
    expect(data.kpis.current.orderValue).toBe(5997);
    expect(data.kpis.previous).toMatchObject({ pageViews: 120, uniqueVisitors: 45 });
    expect(data.days).toBe(14);
  });

  it('zero-fills days with no traffic across both windows', async () => {
    const first = dayKey(0, 3);
    const gap = dayKey(1, 3);
    const last = dayKey(2, 3);
    stubRpcs({
      page_views_by_day: {
        data: [
          { day: last, views: '40', unique_sids: '20' },
          { day: first, views: '10', unique_sids: '5' },
        ],
      },
    });
    const data = await getEngagement(3);

    expect(data.byDay).toHaveLength(3);
    expect(data.previousByDay).toHaveLength(3);
    // The middle day has no rows in the stub: a point with zeros, not a gap.
    expect(data.byDay.find((point) => point.day === gap)).toMatchObject({
      views: 0,
      uniqueVisitors: 0,
    });
    expect(data.byDay.find((point) => point.day === last)).toMatchObject({
      views: 40,
      uniqueVisitors: 20,
    });
    expect(data.byDay.find((point) => point.day === first)).toMatchObject({
      views: 10,
      uniqueVisitors: 5,
    });
  });

  it('enriches ranked products with titles and covers, falling back on unknown ids', async () => {
    stubRpcs({
      top_viewed_products: {
        data: [
          { product_id: 12, views: '30', unique_sids: '18' },
          { product_id: 99, views: '12', unique_sids: '9' },
        ],
      },
      top_cart_adds: { data: [{ product_id: 12, adds: '5' }] },
    });
    const data = await getEngagement(14);

    expect(data.topViewed).toHaveLength(2);
    expect(data.topViewed[0]).toMatchObject({
      productId: 12,
      title: 'Coldplay Tee',
      imageUrl: 'https://r2.example/tee.webp',
      views: 30,
      uniqueVisitors: 18,
    });
    expect(data.topViewed[1].title).toBe('Product #99');
    expect(data.topViewed[1].imageUrl).toBeNull();
    expect(data.topCartAdds[0].title).toBe('Coldplay Tee');
  });

  it('maps search terms, templates, pages, and the view-to-order join', async () => {
    stubRpcs({
      page_views_by_template: {
        data: [
          { template: 'product', views: '80' },
          { template: 'home', views: '40' },
        ],
      },
      top_search_terms: {
        data: [{ term: 'Coldplay', searches: '7', zero_results: '2' }],
      },
      product_view_to_order: {
        data: [{ product_id: 12, views: '30', units: '4' }],
      },
    });
    const data = await getEngagement(14);

    expect(data.templates).toEqual([
      { template: 'product', views: 80 },
      { template: 'home', views: 40 },
    ]);
    expect(data.searchTerms[0]).toEqual({ term: 'Coldplay', searches: 7, zeroResults: 2 });
    expect(data.viewToOrder[0]).toMatchObject({ productId: 12, views: 30, units: 4 });
  });

  it('throws the DatabaseError boundary message when a rollup fails', async () => {
    h.rpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: 'permission denied', code: '42501' } }),
    );
    await expect(getEngagement(14)).rejects.toThrow(/Could not read analytics_events/);
  });

  it('guards a nonsense window down to the default', async () => {
    stubRpcs();
    const data = await getEngagement(Number.NaN);
    expect(data.days).toBe(14);
    expect(data.byDay).toHaveLength(14);
  });
});
