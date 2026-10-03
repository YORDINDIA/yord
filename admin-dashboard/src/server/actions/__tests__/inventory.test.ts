import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `bulkAdjustInventoryAction`, driven through the real action body (same
 * harness shape as the collections action tests):
 *
 * The write goes through the `adjust_inventory_quantities` RPC, which locks
 * the rows and returns each one's previous quantity. The two-query version
 * this replaces let a concurrent save land between the read and the write, so
 * the audit's `before` could be stale. These tests stub the RPC at the client
 * seam and pin: the RPC payload, the audit's `before` built from the RPC's
 * locked values, the partial-existence copy, and the error mapping.
 */

const h = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: {
    data: null as
      | { id: number; product_id: number; previous_quantity: number }[]
      | null,
    error: null as { message: string } | null,
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  createStaticClient: vi.fn(),
}));

vi.mock('@/server/actions/_shared', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/actions/_shared')>('@/server/actions/_shared');
  const service = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ name, args });
      return h.rpcResult;
    },
  };
  return {
    ...actual,
    withAdmin: (action: (context: unknown) => Promise<unknown>) =>
      action({ user: { id: 'u1', email: 'admin@yord.test' }, service, supabase: service }),
    audit: vi.fn(async () => {}),
  };
});

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const { audit } = await import('@/server/actions/_shared');
const { revalidatePath } = await import('next/cache');

const RPC_ROWS = [
  { id: 11, product_id: 3, previous_quantity: 7 },
  { id: 12, product_id: 4, previous_quantity: 0 },
];

describe('bulkAdjustInventoryAction', () => {
  beforeEach(() => {
    h.rpcCalls = [];
    h.rpcResult = { data: null, error: null };
    vi.mocked(audit).mockClear();
    vi.mocked(revalidatePath).mockClear();
  });

  it('calls the locking RPC once and audits the before it returns', async () => {
    h.rpcResult = { data: RPC_ROWS, error: null };
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([
        ['inventory_quantity', '5'],
        ['ids', '11'],
        ['ids', '12'],
      ]),
    );

    expect(state.status).toBe('success');
    expect(state.message).toBe('Set quantity to 5 on 2 variant(s).');
    expect(h.rpcCalls).toEqual([
      {
        name: 'adjust_inventory_quantities',
        args: {
          p_variants: [
            { id: 11, inventory_quantity: 5 },
            { id: 12, inventory_quantity: 5 },
          ],
        },
      },
    ]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.objectContaining({
        action: 'bulk_adjust_inventory',
        entity: 'product_variants',
        entityId: '11,12',
      }),
    );
    const entry = vi.mocked(audit).mock.calls[0][1] as {
      before?: { variants?: { id: number; inventory_quantity: number }[] };
      after?: { variants?: number };
    };
    // The audit's before is the RPC's locked previous quantity — the value
    // immediately before this adjustment, not a separately-read stale one.
    expect(entry.before?.variants).toEqual([
      { id: 11, product_id: 3, inventory_quantity: 7 },
      { id: 12, product_id: 4, inventory_quantity: 0 },
    ]);
    expect(entry.after).toMatchObject({ inventory_quantity: 5, variants: 2 });
    expect(revalidatePath).toHaveBeenCalledWith('/inventory');
  });

  it('reports variants that vanished between page load and save', async () => {
    h.rpcResult = { data: [RPC_ROWS[0]], error: null };
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([
        ['inventory_quantity', '5'],
        ['ids', '11'],
        ['ids', '12'],
      ]),
    );

    expect(state.status).toBe('success');
    expect(state.message).toBe('Set quantity to 5 on 1 variant(s); 1 no longer exist.');
    const entry = vi.mocked(audit).mock.calls[0][1] as { after?: { variants?: number } };
    expect(entry.after).toMatchObject({ variants: 1 });
  });

  it('refuses an empty selection before touching the RPC', async () => {
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([['inventory_quantity', '5']]),
    );

    expect(state.status).toBe('error');
    expect(h.rpcCalls).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it('still refuses a non-integer quantity before touching the RPC', async () => {
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([
        ['inventory_quantity', 'abc'],
        ['ids', '11'],
      ]),
    );

    expect(state.status).toBe('error');
    expect(h.rpcCalls).toEqual([]);
  });

  it('maps the RPC malformed-batch raise to its own cause', async () => {
    h.rpcResult = { data: null, error: { message: 'INVALID_VARIANT_ROWS' } };
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([
        ['inventory_quantity', '5'],
        ['ids', '11'],
      ]),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toContain('database rejected one of the variant rows');
    expect(audit).not.toHaveBeenCalled();
  });

  it('maps any other RPC failure to a nothing-changed error', async () => {
    h.rpcResult = { data: null, error: { message: 'connection refused' } };
    const { bulkAdjustInventoryAction } = await import('@/server/actions/inventory');

    const state = await bulkAdjustInventoryAction(
      { status: 'idle' },
      form([
        ['inventory_quantity', '5'],
        ['ids', '11'],
        ['ids', '12'],
      ]),
    );

    expect(state.status).toBe('error');
    expect(state.formError).toBe('Could not update 2 variant(s). Nothing was changed.');
    expect(audit).not.toHaveBeenCalled();
  });
});
