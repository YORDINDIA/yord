import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Auto-handle preservation on save (reviewer re-verification).
 *
 * `new-arrivals` and `all` are computed by the storefront: their `collects` rows
 * are ignored and the row itself only gates the route (unpublished → 404 for the
 * header/footer links). The edit form renders `published` and `collection_type`
 * as *disabled* for these handles, so the browser omits them from the submission
 * entirely — reading the absent fields as defaults is what unpublished the row,
 * retyped it and rewrote its product list.
 *
 * These tests drive the **real action body**: `withAdmin` is stubbed to hand it a
 * service double, so the payload the action would send to Postgres, and whether
 * it calls `set_collection_products` at all, are both observable. `parseForm` and
 * the schemas stay real.
 */

interface Call {
  kind: 'update' | 'rpc';
  payload?: Record<string, unknown>;
  name?: string;
  args?: unknown;
}

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  row: null as Record<string, unknown> | null,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The app's Supabase boundary: `@/lib/supabase/server` re-exports the workspace
// package's subpath (`@yord/supabase-clients/server`), which vitest's alias table
// does not map. Stubbing this module keeps every other import real — `parseForm`,
// the schemas and the action body under test all stay the production code.
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

vi.mock('@/server/actions/_shared', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/actions/_shared')>('@/server/actions/_shared');
  const service = {
    from: () => query(),
    rpc: async (name: string, args: unknown) => {
      h.calls.push({ kind: 'rpc', name, args });
      return { data: 2, error: null };
    },
  };
  return {
    ...actual,
    // The real wrapper authenticates and converts throws into form errors; the
    // test is about the body it wraps.
    withAdmin: (action: (context: unknown) => Promise<unknown>) =>
      action({ user: { id: 'u1', email: 'admin@yord.test' }, service, supabase: service }),
    audit: vi.fn(async () => {}),
  };
});

function query() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    range: () => builder,
    maybeSingle: async () => ({ data: h.row, error: null }),
    update: (payload: Record<string, unknown>) => {
      h.calls.push({ kind: 'update', payload });
      return builder;
    },
    // `await query.update(...).eq(...)` resolves through the builder.
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  };
  return builder;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const autoRow = {
  id: 77,
  title: 'New Arrivals',
  handle: 'new-arrivals',
  collection_type: 'smart',
  published: true,
  published_at: '2025-01-02T03:04:05.000Z',
  disjunctive: true,
  body_html: null,
  image_src: null,
  sort_order: 'newest',
};

const payloadOf = () => h.calls.find((call) => call.kind === 'update')?.payload ?? {};
const rpcCalls = () => h.calls.filter((call) => call.kind === 'rpc');

describe('updateCollectionAction: auto handles', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = { ...autoRow };
  });

  it('keeps published/type/published_at/disjunctive when the form omits them', async () => {
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      // Exactly what the browser sends for an auto collection: the disabled
      // `published` and `collection_type` controls are absent.
      form({ id: '77', title: 'New Arrivals', handle: 'new-arrivals', body_html: '', image_src: '' }),
    );

    expect(state.status).toBe('success');
    expect(payloadOf()).toMatchObject({
      title: 'New Arrivals',
      handle: 'new-arrivals',
      published: true,
      collection_type: 'smart',
      published_at: '2025-01-02T03:04:05.000Z',
      disjunctive: true,
    });
    // The storefront computes these products, so the save must not rewrite them.
    expect(rpcCalls()).toHaveLength(0);
    expect(state.message).toContain('managed automatically');
  });

  it('normalises a stored manual sort_order to null and refuses the submitted manual', async () => {
    // An auto collection has no `collects.position` order, so `manual` promises
    // an order nothing can produce (the storefront degrades it to `newest`).
    // The editor no longer offers the option; the action normalises whatever
    // is stored or submitted so the row never carries a dead setting.
    h.row = { ...autoRow, sort_order: 'manual' };
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({
        id: '77',
        title: 'New Arrivals',
        handle: 'new-arrivals',
        body_html: '',
        image_src: '',
        sort_order: 'manual',
      }),
    );

    expect(state.status).toBe('success');
    expect(payloadOf()).toMatchObject({ sort_order: null });
  });

  it('keeps a meaningful stored sort_order for an auto collection', async () => {
    // Like `published`/`collection_type`, the stored value wins for an auto
    // handle; the storefront honours price-asc/title sorts on these pages.
    h.row = { ...autoRow, sort_order: 'price-asc' };
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({ id: '77', title: 'New Arrivals', handle: 'new-arrivals', body_html: '', image_src: '' }),
    );

    expect(state.status).toBe('success');
    expect(payloadOf()).toMatchObject({ sort_order: 'price-asc' });
  });

  it('refuses renaming a collection INTO an auto handle instead of duplicating it', async () => {
    h.row = { ...autoRow, id: 88, title: 'Premium Store', handle: 'premium-store', collection_type: 'custom', disjunctive: null };
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({ id: '88', title: 'Premium Store', handle: 'all', body_html: '', image_src: '' }),
    );

    // The old behaviour committed a second row with handle `all`. The storefront
    // resolves a handle with `.maybeSingle()`, which errors when two rows match,
    // and `collections.handle` has no unique constraint to catch it — so the
    // storefront's `/collection/all` link (header/footer) broke. The refusal
    // still guarantees what this test has always been about: no `collects`
    // rewrite for a handle the storefront computes itself.
    expect(state.status).toBe('error');
    expect(payloadOf()).toEqual({});
    expect(rpcCalls()).toHaveLength(0);
  });

  it('still lets the submitted fields win for a normal collection', async () => {
    h.row = {
      ...autoRow,
      id: 99,
      title: 'Coldplay Tour',
      handle: 'coldplay-tour',
      collection_type: 'custom',
      disjunctive: null,
    };
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      // The real form always submits `body_html` (required) and `image_src`.
      form({
        id: '99',
        title: 'Coldplay Tour',
        handle: 'coldplay-tour',
        body_html: '',
        image_src: '',
        product_ids: '11,22',
        sort_order: 'manual',
      }),
    );

    // No `published` field in the submission → the checkbox means "unchecked",
    // and the membership replace goes through the atomic RPC as before. The
    // submitted sort wins for a normal collection, `manual` included.
    expect(payloadOf()).toMatchObject({
      published: false,
      published_at: null,
      collection_type: 'custom',
      sort_order: 'manual',
    });
    expect(state.status).toBe('success');
    expect(rpcCalls()).toHaveLength(1);
    expect(rpcCalls()[0].name).toBe('set_collection_products');
    expect(rpcCalls()[0].args).toEqual({ p_collection_id: 99, p_product_ids: [11, 22] });
  });
});
