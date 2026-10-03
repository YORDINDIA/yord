import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Handle guards + the publish rollback on a failed membership write.
 *
 * `collections.handle` is the storefront route: `/collection/all` and
 * `/collection/new-arrivals` are linked from the header/footer and answered by
 * the storefront itself, gated on the row that carries the handle. Three writes
 * used to be able to break that route, all of them one form submit away:
 *
 *  1. renaming the `all` row (the handle disappears → the link 404s);
 *  2. renaming another collection INTO `all` (two rows, and the storefront
 *     resolves a handle with `.maybeSingle()`, which errors on two matches —
 *     `collections.handle` has no unique constraint);
 *  3. creating a collection whose handle (typed or derived from a title) is
 *     `all`.
 *
 * The fourth case is not about handles: `updateCollectionAction` writes the
 * detail row, then replaces `collects` in a second statement. A failed replace
 * (a nonexistent product id answers a foreign-key error, not
 * COLLECTION_NOT_FOUND) left `published = true` on a collection whose members
 * were never written — the linked empty page `refusePublish` exists to prevent.
 *
 * These tests drive the **real action bodies**: `withAdmin` is stubbed to hand
 * them a service double, so the payloads the actions would send to Postgres are
 * observable. `parseForm` and the schemas stay real.
 */

interface Call {
  kind: 'update' | 'insert' | 'rpc';
  payload?: Record<string, unknown>;
  name?: string;
  args?: unknown;
}

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  row: null as Record<string, unknown> | null,
  /** Rows the publish guard's status lookup (`products.select('id, status')`) answers with. */
  productStatusRows: [] as Record<string, unknown>[],
  rpc: { data: 2, error: null } as { data: number | null; error: { message: string } | null },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The app's Supabase boundary: `@/lib/supabase/server` re-exports the workspace
// package's subpath (`@yord/supabase-clients/server`), which vitest's alias
// table does not map. Stubbing it keeps every other import real.
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

// BIGINT id allocation uses a memoized service client; the value is irrelevant
// to these tests, only that no row is inserted before the guard runs.
vi.mock('@/lib/utils/ids', () => ({ getNextId: async () => 9000000001 }));

vi.mock('@/server/actions/_shared', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/actions/_shared')>('@/server/actions/_shared');
  const service = {
    from: (table: string) => query(table),
    rpc: async (name: string, args: unknown) => {
      h.calls.push({ kind: 'rpc', name, args });
      return h.rpc;
    },
  };
  return {
    ...actual,
    withAdmin: (action: (context: unknown) => Promise<unknown>) =>
      action({ user: { id: 'u1', email: 'admin@yord.test' }, service, supabase: service }),
    audit: vi.fn(async () => {}),
  };
});

function query(table: string) {
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
    insert: (payload: Record<string, unknown>) => {
      h.calls.push({ kind: 'insert', payload });
      return builder;
    },
    // `await query.update(...).eq(...)` resolves through the builder; the
    // publish guard's `products` lookup resolves the status rows instead.
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: table === 'products' ? h.productStatusRows : null, error: null }).then(
        resolve,
      ),
  };
  return builder;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** A stored collection row, shaped as the action reads it. */
function row(overrides: Record<string, unknown>) {
  return {
    id: 99,
    title: 'Coldplay Tour',
    handle: 'coldplay-tour',
    collection_type: 'custom',
    published: false,
    published_at: null,
    disjunctive: null,
    body_html: null,
    image_src: null,
    sort_order: null,
    ...overrides,
  };
}

const updates = () => h.calls.filter((call) => call.kind === 'update').map((call) => call.payload);
const inserts = () => h.calls.filter((call) => call.kind === 'insert').map((call) => call.payload);
const rpcCalls = () => h.calls.filter((call) => call.kind === 'rpc');

describe('collection handle guards', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = row({});
    h.productStatusRows = [];
    h.rpc = { data: 2, error: null };
  });

  it('refuses renaming the auto row away from its handle', async () => {
    h.row = row({ id: 77, title: 'All', handle: 'all', published: true });
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({ id: '77', title: 'All', handle: 'everything', body_html: '', image_src: '' }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('computed collection');
    expect(state.formError).toContain('/collection/all');
    expect(updates()).toEqual([]);
    expect(rpcCalls()).toHaveLength(0);
  });

  it('refuses renaming another collection INTO an auto handle', async () => {
    h.row = row({ id: 88, handle: 'premium-store', published: true });
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({ id: '88', title: 'Premium Store', handle: 'all', body_html: '', image_src: '' }),
    );

    // The duplicate row this used to commit makes the storefront's
    // `.maybeSingle()` error, taking out /collection/all instead of picking one.
    expect(state.status).toBe('error');
    expect(state.formError).toContain('reserved');
    expect(updates()).toEqual([]);
    expect(rpcCalls()).toHaveLength(0);
  });

  it('still saves an auto collection when the handle is unchanged (the hidden field)', async () => {
    h.row = row({ id: 77, title: 'All', handle: 'all', published: true });
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      // What the editor now submits: the handle input is disabled and a hidden
      // field carries the stored value back.
      form({ id: '77', title: 'All products', handle: 'all', body_html: '', image_src: '' }),
    );

    expect(state.status).toBe('success');
    expect(updates()[0]).toMatchObject({ handle: 'all', published: true });
    expect(rpcCalls()).toHaveLength(0);
  });

  it('refuses creating a collection on an auto handle, typed or derived', async () => {
    const { createCollectionAction } = await import('@/server/actions/collections');

    const typed = await createCollectionAction(
      { status: 'idle' },
      form({ title: 'Everything', handle: 'all', collection_type: 'custom', body_html: '' }),
    );
    expect(typed.status).toBe('error');
    expect(typed.formError).toContain('reserved');
    expect(inserts()).toEqual([]);

    const derived = await createCollectionAction(
      { status: 'idle' },
      form({ title: 'All', handle: '', collection_type: 'custom', body_html: '' }),
    );
    expect(derived.status).toBe('error');
    expect(derived.formError).toContain('reserved');
    expect(inserts()).toEqual([]);
  });

  it('creates a normal collection as before', async () => {
    const { createCollectionAction } = await import('@/server/actions/collections');

    const state = await createCollectionAction(
      { status: 'idle' },
      form({ title: 'Monsoon Drop', handle: '', collection_type: 'custom', body_html: '' }),
    );

    expect(state.status).toBe('success');
    expect(inserts()[0]).toMatchObject({ handle: 'monsoon-drop', published: false });
  });
});

describe('publish rollback when the membership write fails', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = row({ published: false, published_at: null });
    // The publish guard looks the submitted ids' statuses up before writing;
    // the product exists and is active, so the flow reaches the RPC failure.
    h.productStatusRows = [{ id: 999999999, status: 'active' }];
    // The foreign key rejects an id whose product no longer exists (a stale
    // editor form). This is NOT COLLECTION_NOT_FOUND, so it takes the generic
    // partial-write branch.
    h.rpc = {
      data: null,
      error: {
        message:
          'insert or update on table "collects" violates foreign key constraint "collects_product_id_fkey"',
      },
    };
  });

  it('takes the publish back off so an empty collection cannot go live', async () => {
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({
        id: '99',
        title: 'Coldplay Tour',
        handle: 'coldplay-tour',
        body_html: '',
        image_src: '',
        published: 'on',
        product_ids: '999999999',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('left unpublished');
    // First the detail write (published: true), then the compensating write.
    expect(updates()).toHaveLength(2);
    expect(updates()[0]).toMatchObject({ published: true });
    expect(updates()[1]).toEqual({ published: false, published_at: null });
  });

  it('does not touch a collection that was already published', async () => {
    h.row = row({ published: true, published_at: '2025-01-02T03:04:05.000Z' });
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({
        id: '99',
        title: 'Coldplay Tour',
        handle: 'coldplay-tour',
        body_html: '',
        image_src: '',
        published: 'on',
        product_ids: '999999999',
      }),
    );

    expect(state.status).toBe('error');
    // Only the detail write: unpublishing a page the admin never asked to
    // unpublish would be worse than the stale membership.
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).toMatchObject({ published: true });
  });

  it('leaves an unpublished save unpublished when the replace fails', async () => {
    const { updateCollectionAction } = await import('@/server/actions/collections');

    const state = await updateCollectionAction(
      { status: 'idle' },
      form({
        id: '99',
        title: 'Coldplay Tour',
        handle: 'coldplay-tour',
        body_html: '',
        image_src: '',
        product_ids: '11,22',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('could not be replaced');
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).toMatchObject({ published: false });
  });
});
