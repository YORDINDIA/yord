import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The publish guard's second half, driven through the real action bodies
 * (same harness shape as `collections-handle-guard.test.ts`): a submitted
 * product set whose members are all inactive renders an empty storefront page
 * even though it is not empty, because the storefront filters inactive
 * products out. Publishing it is refused with the same ActionState shape as
 * the empty-collection refusal; a set with at least one active product saves.
 */

interface Call {
  kind: 'update' | 'insert' | 'rpc';
  table?: string;
  payload?: Record<string, unknown>;
  name?: string;
  args?: unknown;
}

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  row: null as Record<string, unknown> | null,
  /** Rows the status lookup (`products.select('id, status')`) answers with. */
  productStatusRows: [] as Record<string, unknown>[],
  statusError: null as { message: string } | null,
  rpc: { data: 2, error: null } as { data: number | null; error: { message: string } | null },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

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
      h.calls.push({ kind: 'update', table, payload });
      return builder;
    },
    insert: (payload: Record<string, unknown>) => {
      h.calls.push({ kind: 'insert', table, payload });
      return builder;
    },
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(
        table === 'products'
          ? { data: h.productStatusRows, error: h.statusError }
          : { data: null, error: null },
      ).then(resolve),
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

const updates = () => h.calls.filter((call) => call.kind === 'update');
const inserts = () => h.calls.filter((call) => call.kind === 'insert');
const rpcCalls = () => h.calls.filter((call) => call.kind === 'rpc');

describe('updateCollectionAction: all-inactive publish refusal', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = row({});
    h.productStatusRows = [];
    h.statusError = null;
    h.rpc = { data: 2, error: null };
  });

  it('refuses publishing a collection whose submitted products are all draft', async () => {
    h.productStatusRows = [
      { id: 11, status: 'draft' },
      { id: 22, status: 'archived' },
    ];
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
        product_ids: '11,22',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('inactive');
    expect(state.fieldErrors?.product_ids?.[0]).toContain('no active products');
    // Nothing written: no detail update, no membership replace.
    expect(updates()).toEqual([]);
    expect(rpcCalls()).toEqual([]);
  });

  it('saves the publish when at least one submitted product is active', async () => {
    h.productStatusRows = [
      { id: 11, status: 'draft' },
      { id: 22, status: 'active' },
    ];
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
        product_ids: '11,22',
      }),
    );

    expect(state.status).toBe('success');
    expect(updates()[0]?.payload).toMatchObject({ published: true });
    expect(rpcCalls()).toHaveLength(1);
  });

  it('treats a stale id (deleted product) as not active', async () => {
    // Only id 11 answers; 22 was deleted after the page loaded. A product the
    // storefront cannot render must not satisfy the guard.
    h.productStatusRows = [{ id: 11, status: 'draft' }];
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
        product_ids: '11,22',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.fieldErrors?.product_ids?.[0]).toContain('no active products');
  });

  it('reports a failed status lookup without saving the publish', async () => {
    h.statusError = { message: 'connection reset' };
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
        product_ids: '11,22',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('Could not check the products');
    expect(updates()).toEqual([]);
    expect(rpcCalls()).toEqual([]);
  });

  it('does not look statuses up for an unpublished save', async () => {
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

    // No `published` field → unchecked save; the products query never runs
    // (it would resolve empty rows here and refuse a save that needs no guard).
    expect(state.status).toBe('success');
    expect(updates()).toHaveLength(1);
    expect(rpcCalls()).toHaveLength(1);
  });
});

describe('createCollectionAction: all-inactive publish refusal', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = null;
    h.productStatusRows = [];
    h.statusError = null;
    h.rpc = { data: 2, error: null };
  });

  it('refuses creating a published collection from inactive products', async () => {
    h.productStatusRows = [{ id: 11, status: 'draft' }];
    const { createCollectionAction } = await import('@/server/actions/collections');

    const state = await createCollectionAction(
      { status: 'idle' },
      form({
        title: 'Monsoon Drop',
        handle: '',
        collection_type: 'custom',
        body_html: '',
        published: 'on',
        product_ids: '11',
      }),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('inactive');
    expect(state.formError).toContain('create it unpublished');
    expect(inserts()).toEqual([]);
    expect(rpcCalls()).toEqual([]);
  });

  it('creates normally when the products are active', async () => {
    h.productStatusRows = [{ id: 11, status: 'active' }];
    const { createCollectionAction } = await import('@/server/actions/collections');

    const state = await createCollectionAction(
      { status: 'idle' },
      form({
        title: 'Monsoon Drop',
        handle: '',
        collection_type: 'custom',
        body_html: '',
        published: 'on',
        product_ids: '11',
      }),
    );

    expect(state.status).toBe('success');
    expect(inserts()[0]?.payload).toMatchObject({ published: true, handle: 'monsoon-drop' });
    expect(rpcCalls()).toHaveLength(1);
  });
});
