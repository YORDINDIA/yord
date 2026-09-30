"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useActionForm } from "@/components/forms/ActionForm";
import { updateInventoryAction } from "@/server/actions/inventory";

/**
 * Per-row inventory stepper.
 *
 * Previously took a `action` prop and ran it inside a `useTransition`, then
 * read `{ error }` off the result. It now runs the shared `updateInventoryAction`
 * through `useActionForm`, so a failed save raises the same toast and banner as
 * every other admin write, and `pending` comes from the action itself.
 */
export default function QuantityStepper({
  variantId,
  initial,
}: {
  variantId: number;
  initial: number;
}) {
  const [value, setValue] = useState(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = value !== initial;

  const { state, pending, formAction } = useActionForm(updateInventoryAction, {
    onResult: (result) => {
      // A successful write revalidates the route, which re-renders this row with
      // the stored quantity; the local edit is now the persisted value.
      if (result.status === "success") formRef.current?.reset();
    },
  });

  return (
    <form ref={formRef} action={formAction} className="toolbar">
      <input type="hidden" name="variant_id" value={variantId} />
      <input type="hidden" name="inventory_quantity" value={value} />

      {state.status === "error" && state.formError && (
        <span className="field-error" role="alert">
          {state.formError}
        </span>
      )}

      <button
        type="button"
        className="button icon-button"
        aria-label={`Decrease inventory for variant ${variantId}`}
        disabled={pending}
        onClick={() => setValue((current) => Math.max(0, current - 1))}
      >
        <Minus size={14} />
      </button>
      <input
        className="input"
        type="number"
        min={0}
        step={1}
        value={value}
        aria-label={`Inventory quantity for variant ${variantId}`}
        onChange={(event) =>
          setValue(Math.max(0, Math.floor(Number(event.target.value) || 0)))
        }
      />
      <button
        type="button"
        className="button icon-button"
        aria-label={`Increase inventory for variant ${variantId}`}
        disabled={pending}
        onClick={() => setValue((current) => current + 1)}
      >
        <Plus size={14} />
      </button>
      {dirty && (
        <button type="submit" className="button primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      )}
    </form>
  );
}
