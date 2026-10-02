'use client';

import { useState } from 'react';
import { AlertCircle, Check, Minus, Plus } from 'lucide-react';
import { useActionForm } from '@/components/forms/ActionForm';
import { updateInventoryAction } from '@/server/actions/inventory';
import styles from './inventory.module.css';

/**
 * Compact per-row inventory stepper.
 *
 * 28px tall on desktop (24px controls) and 34px on mobile, so the row stays at
 * the dense table height instead of the 71px the old inline toolbar produced
 * when its controls wrapped. Controls, in order: decrease, quantity, increase,
 * save. The save button holds its slot at all times (`visibility` via
 * `data-dirty`) — a button that mounted on edit would change the row height
 * mid-interaction — and it is `disabled` while the value is clean.
 *
 * Field names (`variant_id`, `inventory_quantity`) and the action
 * (`updateInventoryAction`) are unchanged, so this is still the same audited
 * write as before. Feedback is unchanged too: the number is optimistic local
 * state, a failed save raises the shared toast plus the in-row glyph, and the
 * stored quantity is untouched — the typed value stays put so the admin can fix
 * and retry rather than retype.
 *
 * The save button carries an icon rather than the word "Save": at 34px of row
 * height a text button cannot fit next to the input, and every control keeps an
 * explicit `aria-label` that names the product and variant.
 */
export default function QuantityStepper({
  variantId,
  initial,
  label,
}: {
  variantId: number;
  initial: number;
  /** Row identity — product and variant — used by every control's label. */
  label: string;
}) {
  const [value, setValue] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);

  // Re-sync when the server re-renders the row with the stored quantity (a
  // successful save revalidates `/inventory`). Adjusting state during render,
  // keyed on the last observed prop, is the pattern `SearchInput` uses; an
  // effect would flash the stale value for a frame. A save on another row
  // leaves this row's prop untouched, so an in-flight edit is never clobbered.
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }

  const dirty = value !== initial;
  const { state, pending, formAction, errorFor } = useActionForm(updateInventoryAction);
  // `formError` is the usual path (the action reports a bad quantity that way);
  // the field message is the fallback, so a schema rejection can never be silent.
  const error =
    state.status === 'error' ? (state.formError ?? errorFor('inventory_quantity')) : undefined;

  return (
    <form className={styles.stepper} action={formAction}>
      <input type="hidden" name="variant_id" value={variantId} />
      <input type="hidden" name="inventory_quantity" value={value} />

      <button
        type="button"
        className={styles.step}
        aria-label={`Decrease quantity for ${label}`}
        disabled={pending}
        onClick={() => setValue((current) => Math.max(0, current - 1))}
      >
        <Minus size={13} aria-hidden />
      </button>

      <input
        className={styles.qty}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value}
        aria-label={`Quantity for ${label}`}
        disabled={pending}
        onChange={(event) =>
          setValue(Math.max(0, Math.floor(Number(event.target.value) || 0)))
        }
      />

      <button
        type="button"
        className={styles.step}
        aria-label={`Increase quantity for ${label}`}
        disabled={pending}
        onClick={() => setValue((current) => current + 1)}
      >
        <Plus size={13} aria-hidden />
      </button>

      <button
        type="submit"
        className={styles.save}
        data-dirty={dirty ? 'true' : 'false'}
        aria-label={`Save quantity for ${label}`}
        aria-busy={pending}
        disabled={pending || !dirty}
      >
        <Check size={13} aria-hidden />
      </button>

      {error && (
        // The glyph is the visible half; the message is announced and the tooltip
        // carries it for a mouse. A text line here would grow the row on failure.
        <span className={styles.errorGlyph} title={error}>
          <AlertCircle size={13} aria-hidden />
          <span className="sr-only" role="alert">
            {error}
          </span>
        </span>
      )}
    </form>
  );
}
