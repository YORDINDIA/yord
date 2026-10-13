import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
  client: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => h.client,
  createServiceClient: () => h.client,
  createStaticClient: () => h.client,
}));

function mockClient() {
  return {
    from(table: string) {
      let range: [number, number] = [0, 999];
      let limit: number | null = null;
      const filters: { column: string; values: unknown[] }[] = [];
      const ordering: { column: string; ascending: boolean; nullsFirst: boolean }[] = [];
      const builder = {
        select(...args: unknown[]) {
          h.calls.push({ table, method: 'select', args });
          return builder;
        },
        in(...args: unknown[]) {
          h.calls.push({ table, method: 'in', args });
          filters.push({ column: String(args[0]), values: args[1] as unknown[] });
          return builder;
        },
        eq(...args: unknown[]) {
          h.calls.push({ table, method: 'eq', args });
          filters.push({ column: String(args[0]), values: [args[1]] });
          return builder;
        },
        order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}) {
          const args = [column, options];
          h.calls.push({ table, method: 'order', args });
          ordering.push({
            column,
            ascending: options.ascending !== false,
            nullsFirst: options.nullsFirst === true,
          });
          return builder;
        },
        range(from: number, to: number) {
          range = [from, to];
          h.calls.push({ table, method: 'range', args: [from, to] });
          return builder;
        },
        limit(value: number) {
          limit = value;
          h.calls.push({ table, method: 'limit', args: [value] });
          return builder;
        },
        then(resolve: (value: unknown) => unknown) {
          let data = (h.tables[table] ?? []).filter((row) =>
            filters.every(({ column, values }) => values.includes(row[column]))
          );
          data.sort((left, right) => {
            for (const order of ordering) {
              const a = left[order.column];
              const b = right[order.column];
              if (a === b) continue;
              if (a == null || b == null) {
                const nullsFirst = order.nullsFirst;
                return a == null === nullsFirst ? -1 : 1;
              }
              const compared = String(a).localeCompare(String(b));
              if (compared !== 0) return order.ascending ? compared : -compared;
            }
            return 0;
          });
          const count = data.length;
          data = limit === null ? data.slice(range[0], range[1] + 1) : data.slice(0, limit);
          return Promise.resolve({ data, error: null, count }).then(resolve);
        },
      };
      return builder;
    },
  };
}

describe('admin data reads past PostgREST response windows', () => {
  beforeEach(() => {
    h.tables = {};
    h.calls = [];
    h.client = mockClient();
  });

  it('asks the media source for its oldest window before merging', async () => {
    h.tables.product_images = [
      { id: 1, product_id: 10, storage_url: 'https://cdn.test/old.webp', created_at: '2020-01-01' },
      { id: 2, product_id: 10, storage_url: 'https://cdn.test/new.webp', created_at: '2025-01-01' },
    ];
    const { listMediaAssets } = await import('@/lib/data/media');

    const result = await listMediaAssets({ source: 'product', sort: 'oldest', pageSize: 1 });

    expect(result.rows[0]?.url).toBe('https://cdn.test/old.webp');
    expect(h.calls.filter((call) => call.table === 'product_images' && call.method === 'order')).toEqual([
      { table: 'product_images', method: 'order', args: ['created_at', { ascending: true }] },
      { table: 'product_images', method: 'order', args: ['id', { ascending: true }] },
    ]);
  });

  it('counts blog articles across multiple 1000-row response windows', async () => {
    h.tables.blogs = [{ id: 7, title: 'Tour', handle: 'tour' }];
    h.tables.articles = Array.from({ length: 1105 }, (_, index) => ({
      blog_id: 7,
      published: index === 0,
      updated_at: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
      image_src: index === 0 ? 'https://cdn.test/cover.webp' : null,
      storage_image_url: null,
    }));
    const { listBlogsWithMeta } = await import('@/lib/data/blogs');

    const result = await listBlogsWithMeta({ pageSize: 10 });

    expect(result.rows[0]?.meta.articleCount).toBe(1105);
    expect(result.rows[0]?.meta.publishedCount).toBe(1);
    expect(h.calls.filter((call) => call.table === 'articles' && call.method === 'range').map((call) => call.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('bounds customer order lookups when one listed customer has no orders', async () => {
    h.tables.customers = [
      { id: 1, created_at: '2025-01-01', first_name: 'A', last_name: null, email: 'a@test' },
      { id: 2, created_at: '2025-01-01', first_name: 'B', last_name: null, email: 'b@test' },
    ];
    h.tables.orders = [
      ...Array.from({ length: 1105 }, (_, index) => ({
        customer_id: 1,
        created_at: new Date(Date.UTC(2025, 0, 2, 0, index)).toISOString(),
      })),
    ];
    const { listCustomers } = await import('@/lib/data/customers');

    const result = await listCustomers({ pageSize: 2 });

    expect(result.rows.map((row) => row.lastOrderAt)).toEqual([
      '2025-01-02T18:24:00.000Z',
      null,
    ]);
    expect(h.calls.filter((call) => call.table === 'orders' && call.method === 'eq').map((call) => call.args)).toEqual([
      ['customer_id', 1],
      ['customer_id', 2],
    ]);
    expect(h.calls.filter((call) => call.table === 'orders' && call.method === 'limit').map((call) => call.args)).toEqual([
      [1],
      [1],
    ]);
    expect(h.calls.some((call) => call.table === 'orders' && call.method === 'range')).toBe(false);
  });
});
