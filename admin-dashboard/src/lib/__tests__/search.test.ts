import { describe, expect, it, vi } from 'vitest';

/**
 * The command palette's live search.
 *
 * The palette's product filter must stay column-for-column with
 * `listProducts`' search — a product findable by tag in the catalog that never
 * appears in the palette is a broken promise, which is exactly how `tags` went
 * missing here. The test captures the `.or()` filters the real module builds
 * (through a stubbed `reader()`; `rows` just awaits the builder) and asserts
 * the shape, since the filter string is the contract PostgREST sees.
 */

interface Builder {
  select: () => Builder;
  or: (filter: string) => Builder;
  order: () => Builder;
  limit: () => Builder;
  then: (resolve: (value: { data: unknown[]; error: null; count: null }) => unknown) => unknown;
}

const h = vi.hoisted(() => ({
  /** `.or()` filter strings in call order: products, orders, customers. */
  orFilters: [] as string[],
}));

vi.mock('@/lib/data/client', () => ({
  reader: async () => ({
    from: () => {
      const builder: Builder = {
        select: () => builder,
        or: (filter: string) => {
          h.orFilters.push(filter);
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        then: (resolve) => Promise.resolve({ data: [], error: null, count: null }).then(resolve),
      };
      return builder;
    },
  }),
  rows: async (_entity: string, query: PromiseLike<{ data: unknown[] }>) => (await query).data,
}));

const { searchAll } = await import('@/lib/data/search');

describe('searchAll', () => {
  it('searches product tags the same way listProducts does', async () => {
    h.orFilters = [];
    const results = await searchAll('coldplay');

    expect(results.products).toEqual([]);
    expect(h.orFilters[0]).toBe(
      'title.ilike.%coldplay%,handle.ilike.%coldplay%,tags.ilike.%coldplay%',
    );
  });

  it('leaves the order and customer columns alone', async () => {
    h.orFilters = [];
    await searchAll('ada');

    expect(h.orFilters[1]).toBe('name.ilike.%ada%,email.ilike.%ada%');
    expect(h.orFilters[2]).toBe('first_name.ilike.%ada%,last_name.ilike.%ada%,email.ilike.%ada%');
  });

  it('issues no filter for a term that sanitizes to nothing', async () => {
    h.orFilters = [];
    const results = await searchAll('(),*"');

    expect(results).toEqual({
      products: [],
      orders: [],
      customers: [],
    });
    expect(h.orFilters).toEqual([]);
  });
});
