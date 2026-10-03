import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two writes this round adds to the collections section, driven through the
 * real action bodies (same harness shape as `collections-auto-handle.test.ts`):
 *
 *  - `deleteCollectionAction` — refused for the auto handles the storefront
 *    computes and links, audited with the row captured *before* the delete (the
 *    only place its title/handle survive), and silent when the delete fails.
 *
 *  - `previewSmartRulesAction`'s membership diff — "Preview matches" used to
 *    report only how many products the rules match, which is not the number an
 *    admin needs before pressing a button that replaces the whole membership.
 *    The payload now carries adds/removes/unchanged plus titled samples, with a
 *    `#id` fallback for rows the title lookup misses.
 */

interface Call {
  kind: 'update' | 'delete' | 'rpc';
  table?: string;
  payload?: Record<string, unknown>;
  name?: string;
}

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  row: null as Record<string, unknown> | null,
  /** Rows the title lookup (`products.select('id, title')`) answers with. */
  selectRows: [] as Record<string, unknown>[],
  readError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  match: null as { ids: number[]; sample: { id: number; title: string }[]; unsupported: unknown[] } | null,
  currentIds: [] as number[],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

// `resolveSmartRuleMatches` / `listCollectionProductIds` are data-layer reads
// with their own clients; the preview tests stub them at this seam so the
// action's diff arithmetic and payload stay the code under test.
vi.mock('@/lib/data/collections', () => ({
  resolveSmartRuleMatches: vi.fn(async () => h.match),
  listCollectionProductIds: vi.fn(async () => h.currentIds),
}));

vi.mock('@/server/actions/_shared', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/actions/_shared')>('@/server/actions/_shared');
  const service = {
    from: (table: string) => query(table),
    rpc: async (name: string) => {
      h.calls.push({ kind: 'rpc', name });
      return { data: 0, error: null };
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
    maybeSingle: async () => ({ data: h.row, error: h.readError }),
    update: (payload: Record<string, unknown>) => {
      h.calls.push({ kind: 'update', table, payload });
      return builder;
    },
    delete: () => {
      h.calls.push({ kind: 'delete', table });
      return builder;
    },
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(
        h.deleteError && h.calls.some((call) => call.kind === 'delete')
          ? { data: null, error: h.deleteError }
          : { data: h.selectRows, error: null },
      ).then(resolve),
  };
  return builder;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const row = {
  id: 42,
  title: 'Coldplay Tour',
  handle: 'coldplay-tour',
  collection_type: 'custom',
  published: true,
};

const { audit } = await import('@/server/actions/_shared');

describe('deleteCollectionAction', () => {
  beforeEach(() => {
    h.calls = [];
    h.row = { ...row };
    h.readError = null;
    h.deleteError = null;
    vi.mocked(audit).mockClear();
  });

  it('deletes one row and audits with the captured row', async () => {
    const { deleteCollectionAction } = await import('@/server/actions/collections');

    const state = await deleteCollectionAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('success');
    expect(state.data).toEqual({ id: 42 });
    expect(h.calls).toEqual([{ kind: 'delete', table: 'collections' }]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.objectContaining({ action: 'delete', entity: 'collections', entityId: 42 }),
    );
    const entry = vi.mocked(audit).mock.calls[0][1] as { before?: Record<string, unknown> };
    expect(entry.before).toMatchObject({ title: 'Coldplay Tour', handle: 'coldplay-tour' });
  });

  it('refuses the auto handles the storefront computes and links', async () => {
    h.row = { ...row, handle: 'all', title: 'All' };
    const { deleteCollectionAction } = await import('@/server/actions/collections');

    const state = await deleteCollectionAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('error');
    expect(h.calls).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('does nothing when the collection is already gone', async () => {
    h.row = null;
    const { deleteCollectionAction } = await import('@/server/actions/collections');

    const state = await deleteCollectionAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('error');
    expect(h.calls).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('reports a failed delete without logging one', async () => {
    h.deleteError = { message: 'foreign key constraint' };
    const { deleteCollectionAction } = await import('@/server/actions/collections');

    const state = await deleteCollectionAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('error');
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('previewSmartRulesAction: membership diff', () => {
  beforeEach(() => {
    h.calls = [];
    h.readError = null;
    h.deleteError = null;
    h.selectRows = [];
    h.match = { ids: [], sample: [], unsupported: [] };
    h.currentIds = [];
    h.row = { id: 42, collection_type: 'smart' };
  });

  it('reports adds and removes with titled samples', async () => {
    h.match = {
      ids: [11, 12, 13],
      sample: [{ id: 11, title: 'Coldplay Tee' }],
      unsupported: [],
    };
    h.currentIds = [12, 88];
    h.selectRows = [
      { id: 11, title: 'Coldplay Tee' },
      { id: 88, title: 'Swift Hoodie' },
    ];
    const { previewSmartRulesAction } = await import('@/server/actions/collections');

    const state = await previewSmartRulesAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('success');
    expect(state.data).toMatchObject({
      count: 3,
      adds: 2,
      removes: 1,
      unchanged: 1,
      sampleAdds: [
        { id: 11, title: 'Coldplay Tee' },
        { id: 13, title: '#13' },
      ],
      sampleRemoves: [{ id: 88, title: 'Swift Hoodie' }],
    });
  });

  it('shows an empty match as removing every current member', async () => {
    h.match = { ids: [], sample: [], unsupported: [] };
    h.currentIds = [7, 8];
    const { previewSmartRulesAction } = await import('@/server/actions/collections');

    const state = await previewSmartRulesAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('success');
    expect(state.data).toMatchObject({ count: 0, adds: 0, removes: 2, unchanged: 0 });
  });

  it('refuses a custom collection without touching the diff', async () => {
    h.row = { id: 42, collection_type: 'custom' };
    const { previewSmartRulesAction } = await import('@/server/actions/collections');

    const state = await previewSmartRulesAction({ status: 'idle' }, form({ collection_id: '42' }));

    expect(state.status).toBe('error');
    expect(state.data).toBeUndefined();
  });
});
