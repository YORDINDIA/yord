'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActionForm } from '@/components/forms/ActionForm';
import { updateVariantsAction } from '@/server/actions/products';

export type VariantRow = {
  id: number;
  title: string | null;
  price: number | null;
  compare_at_price: number | null;
  inventory_quantity: number | null;
};

/**
 * Variant editor.
 *
 * Used to build a JSON blob in the browser, hand it to a page-level action, and
 * `preventDefault()` on submit, so nothing was ever validated or reported. It now
 * submits `FormData` to `updateVariantsAction`, which validates the payload and
 * applies it in one statement.
 */
export default function VariantEditor({
  variants,
  productId,
}: {
  variants: VariantRow[];
  productId: number;
}) {
  const [rows, setRows] = useState<VariantRow[]>(variants);
  const router = useRouter();

  // Only rows the admin actually touched are submitted. The old payload sent
  // every row's inventory value on each save, so fixing one price rewrote all
  // variants' stock with the stale values from page load — restoring units a
  // completed checkout had just decremented. Untouched rows are excluded, so a
  // price-only save cannot move inventory it never displayed as editable.
  const baselineById = new Map(variants.map((row) => [row.id, row]));
  const changedRows = rows.filter((row) => {
    const base = baselineById.get(row.id);
    return (
      !base ||
      base.price !== row.price ||
      base.compare_at_price !== row.compare_at_price ||
      base.inventory_quantity !== row.inventory_quantity
    );
  });
  const dirty = changedRows.length > 0;
  // Inventory this save will actually write (subset of the touched rows).
  const inventoryTouched = changedRows.some(
    (row) => baselineById.get(row.id)?.inventory_quantity !== row.inventory_quantity,
  );
  // Field-aware payload: a touched row carries `include_inventory` only when
  // its stock field actually changed, so the bulk writer leaves inventory (and
  // any checkout decrement since page load) alone on price-only edits.
  const payloadRows = changedRows.map((row) => ({
    ...row,
    include_inventory:
      baselineById.get(row.id)?.inventory_quantity !== row.inventory_quantity,
  }));

  const { state, pending, formAction } = useActionForm(updateVariantsAction, {
    onResult: (result) => {
      // The action revalidates the route; refresh so the editor baseline matches
      // what was actually saved and the dirty bar clears.
      if (result.status === 'success') router.refresh();
    },
  });

  function set(id: number, field: keyof VariantRow, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, [field]: value === '' ? null : Number(value) }
          : row,
      ),
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="product_id" value={productId} />
      {/* Sparse payload: untouched variants are omitted so the bulk writer
          leaves their prices and stock exactly as checkout left them. */}
      <input type="hidden" name="payload" value={JSON.stringify(payloadRows)} />

      {state.status === 'error' && state.formError && (
        <div className="form-alert form-alert-error" role="alert" style={{ marginBottom: 12 }}>
          {state.formError}
        </div>
      )}

      {dirty && (
        <div className="save-bar" style={{ marginBottom: 12 }}>
          <span className="helper">
            {changedRows.length} changed variant{changedRows.length === 1 ? '' : 's'} · unsaved
            price/inventory changes
          </span>
          <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? 'Saving…' : 'Save Changed Variants'}
          </button>
        </div>
      )}
      {dirty && inventoryTouched && (
        <div className="helper" style={{ marginBottom: 12 }}>
          This save writes inventory. Stock shown is from page load — reload the page first if a
          checkout may have sold units since.
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Product variants</caption>
          <thead>
            <tr>
              <th scope="col">Variant</th>
              <th scope="col" className="align-right">Price</th>
              <th scope="col" className="align-right">Compare At</th>
              <th scope="col" className="align-right">Inventory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.title || 'Default'}</th>
                <td className="align-right">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    aria-label={`Price for ${row.title || 'Default'}`}
                    value={row.price ?? ''}
                    onChange={(event) => set(row.id, 'price', event.target.value)}
                  />
                </td>
                <td className="align-right">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    aria-label={`Compare-at price for ${row.title || 'Default'}`}
                    value={row.compare_at_price ?? ''}
                    onChange={(event) => set(row.id, 'compare_at_price', event.target.value)}
                  />
                </td>
                <td className="align-right">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Inventory for ${row.title || 'Default'}`}
                    value={row.inventory_quantity ?? ''}
                    onChange={(event) => set(row.id, 'inventory_quantity', event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="button" type="submit" style={{ marginTop: 12 }} disabled={pending || !dirty} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Changed Variants'}
      </button>
    </form>
  );
}
