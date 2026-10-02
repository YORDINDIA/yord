'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import { useActionForm } from '@/components/forms/ActionForm';
import { updateVariantsAction } from '@/server/actions/products';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { stockClass } from './stock-tone';
import styles from './products.module.css';

export type VariantRow = {
  id: number;
  title: string | null;
  price: number | null;
  compare_at_price: number | null;
  inventory_quantity: number | null;
  /** Read-only: the write path does not accept a SKU or a position change. */
  sku?: string | null;
  position?: number | null;
};

type FieldErrors = {
  price?: string;
  compare_at_price?: string;
  inventory_quantity?: string;
};

/**
 * Client-side mirror of `variantRowSchema`.
 *
 * The same three rules the server enforces: prices `>= 0`, inventory a whole
 * number `>= 0`. Nothing stricter is added — the point is fast feedback, not a
 * second set of semantics that could block a save the action would accept.
 */
function validateRow(row: VariantRow): FieldErrors {
  const errors: FieldErrors = {};
  const { price, compare_at_price: compareAt, inventory_quantity: inventory } = row;

  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    errors.price = 'Price must be 0 or more.';
  }
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0)) {
    errors.compare_at_price = 'Must be 0 or more.';
  }
  if (
    inventory !== null &&
    (!Number.isFinite(inventory) || !Number.isInteger(inventory) || inventory < 0)
  ) {
    errors.inventory_quantity = 'Whole units, 0 or more.';
  }
  return errors;
}

function firstError(errors: FieldErrors): string | undefined {
  return errors.price ?? errors.compare_at_price ?? errors.inventory_quantity;
}

/**
 * Variant editor.
 *
 * A real table over `<DataTable>` (dense rows, sticky header) instead of a
 * hand-rolled `<table>`; each editable cell keeps the accessible name its
 * input had, plus an id/`aria-describedby` pair so the inline message is read
 * with the field.
 *
 * The submitted payload is unchanged: `updateVariantsAction` still receives
 * `payload` (JSON) with `id`, `title`, `price`, `compare_at_price`,
 * `inventory_quantity` and `include_inventory`, and only rows whose price or
 * stock actually changed. The old payload sent every row's inventory value on
 * each save, so fixing one price rewrote all variants' stock with the stale
 * values from page load — restoring units a completed checkout had just
 * decremented. Untouched rows are excluded, so a price-only save cannot move
 * inventory it never displayed as editable.
 *
 * Adding a variant is deliberately not offered here: `set_product_variants` is
 * id-keyed (it updates rows, it cannot insert one), and there is no create-
 * variant action, so an "add row" control would be a button that cannot save.
 *
 * The three numeric cells are uncontrolled (`defaultValue` + `onChange`). A
 * controlled `type="number"` input clears itself the moment its text is an
 * incomplete number — typing `1299.` reports `value === ''` — so a decimal
 * price could never be typed. State still receives every parsed value, so dirty
 * tracking, the stock tones, and the submitted payload are unchanged.
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
  // Keys are listed explicitly (not spread) so the payload shape stays exactly
  // what `parseVariantRows` has always accepted.
  const payloadRows = changedRows.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    compare_at_price: row.compare_at_price,
    inventory_quantity: row.inventory_quantity,
    include_inventory: baselineById.get(row.id)?.inventory_quantity !== row.inventory_quantity,
  }));

  const errorsById = new Map(rows.map((row) => [row.id, validateRow(row)] as const));
  const invalid = rows.some((row) => Boolean(firstError(errorsById.get(row.id) ?? {})));

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
        row.id === id ? { ...row, [field]: value === '' ? null : Number(value) } : row,
      ),
    );
  }

  const columns: DataTableColumn<VariantRow>[] = [
    {
      key: 'variant',
      header: 'Variant',
      // One line, always. The title used to sit above its SKU: a long title
      // wrapped to two 18px lines and took the row to 60px, because the
      // variant cell was then taller than the 30px inputs. The SKU moved to
      // its own column, so nothing in this row exceeds the inputs.
      render: (row) => (
        <div className={`cell-title ${styles.variantTitle}`} title={row.title || 'Default'}>
          {row.title || 'Default'}
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      hideOnTablet: true,
      render: (row) => {
        const sku = row.sku?.trim();
        if (!sku) return null;
        return (
          <span className={`mono helper ${styles.skuText}`} title={sku}>
            {sku}
          </span>
        );
      },
    },
    {
      key: 'position',
      header: 'Pos.',
      align: 'right',
      hideOnTablet: true,
      render: (row) => <span className="num helper">{row.position ?? '—'}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (row) => {
        const error = errorsById.get(row.id)?.price;
        return (
          <div className={styles.numCell}>
            <input
              className={`input ${styles.numInput}`}
              id={`variant-${row.id}-price`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              aria-label={`Price for ${row.title || 'Default'}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `variant-${row.id}-price-error` : undefined}
              defaultValue={row.price ?? ''}
              onChange={(event) => set(row.id, 'price', event.target.value)}
            />
            {error && (
              <div className="field-error" id={`variant-${row.id}-price-error`} role="alert">
                {error}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'compare',
      header: 'Compare at',
      align: 'right',
      hideOnMobile: true,
      render: (row) => {
        const error = errorsById.get(row.id)?.compare_at_price;
        return (
          <div className={styles.numCell}>
            <input
              className={`input ${styles.numInput}`}
              id={`variant-${row.id}-compare`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              aria-label={`Compare-at price for ${row.title || 'Default'}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `variant-${row.id}-compare-error` : undefined}
              defaultValue={row.compare_at_price ?? ''}
              onChange={(event) => set(row.id, 'compare_at_price', event.target.value)}
            />
            {error && (
              <div className="field-error" id={`variant-${row.id}-compare-error`} role="alert">
                {error}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'inventory',
      header: 'Inventory',
      align: 'right',
      render: (row) => {
        const error = errorsById.get(row.id)?.inventory_quantity;
        const quantity = Number(row.inventory_quantity ?? 0);
        return (
          <div className={`${styles.numCell} ${styles[stockClass(quantity)]}`}>
            <input
              className={`input ${styles.numInput}`}
              id={`variant-${row.id}-inventory`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              title={
                quantity <= 0
                  ? 'Out of stock'
                  : quantity <= LOW_STOCK_THRESHOLD
                    ? `Low stock (≤ ${LOW_STOCK_THRESHOLD})`
                    : 'In stock'
              }
              aria-label={`Inventory for ${row.title || 'Default'}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `variant-${row.id}-inventory-error` : undefined}
              defaultValue={row.inventory_quantity ?? ''}
              onChange={(event) => set(row.id, 'inventory_quantity', event.target.value)}
            />
            {error && (
              <div className="field-error" id={`variant-${row.id}-inventory-error`} role="alert">
                {error}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <form action={formAction}>
      <input type="hidden" name="product_id" value={productId} />
      {/* Sparse payload: untouched variants are omitted so the bulk writer
          leaves their prices and stock exactly as checkout left them. */}
      <input type="hidden" name="payload" value={JSON.stringify(payloadRows)} />

      {state.status === 'error' && state.formError && (
        <div className="form-alert form-alert-error tone-rose" role="alert" style={{ marginBottom: 10 }}>
          {state.formError}
        </div>
      )}

      {dirty && (
        <div className="save-bar" style={{ marginBottom: 10 }}>
          <span className="helper">
            {changedRows.length} changed variant{changedRows.length === 1 ? '' : 's'} · unsaved
            price/inventory changes
          </span>
          <button
            className="button primary"
            type="submit"
            disabled={pending || invalid}
            aria-busy={pending}
          >
            {pending ? 'Saving…' : 'Save changed variants'}
          </button>
        </div>
      )}

      <DataTable
        caption="Product variants"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        stickyHeader
        emptyTitle="No variants"
        emptyHint="Every product should have at least one variant; this one has none."
      />

      {dirty && inventoryTouched && (
        <div className="helper" style={{ marginTop: 10 }}>
          This save writes inventory. Stock shown is from page load — reload the page first if a
          checkout may have sold units since.
        </div>
      )}

      {invalid && (
        <div className="field-error" role="alert" style={{ marginTop: 10 }}>
          Fix the highlighted values before saving.
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 10 }}>
        <button
          className="button primary"
          type="submit"
          disabled={pending || !dirty || invalid}
          aria-busy={pending}
        >
          {pending ? 'Saving…' : 'Save changed variants'}
        </button>
      </div>
    </form>
  );
}
