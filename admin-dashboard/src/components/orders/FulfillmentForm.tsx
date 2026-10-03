'use client';

import { useRef } from 'react';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { addFulfillmentAction } from '@/server/actions/orders';

/**
 * Record a shipment.
 *
 * The order's fulfillment history renders above this form as a timeline, so the
 * form is only the write. Behaviour is unchanged from the version that also
 * listed the history: the tracking row is written by `addFulfillmentAction`,
 * which reports the partial-failure case where the tracking row lands but the
 * order status flip does not.
 */
export default function FulfillmentForm({ orderId }: { orderId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, formAction, errorFor } = useActionForm(addFulfillmentAction, {
    onResult: (result) => {
      // Clear the tracking fields: leaving the AWB number in place would make
      // the next click a duplicate fulfillment. `reset()` restores each control
      // to its default, so the empty (attribute-less) inputs clear while the
      // hidden `order_id` — whose `value` attribute is its default — is
      // preserved.
      if (result.status === 'success') formRef.current?.reset();
    },
  });

  return (
    <form ref={formRef} action={formAction} className="stack-sm" noValidate>
      <input type="hidden" name="order_id" value={orderId} />

      <FormError state={state} />

      <div className="form-grid">
        <ActionField name="tracking_company" label="Tracking Company" state={state}>
          <input
            className="input"
            id="tracking_company"
            name="tracking_company"
            placeholder="Delhivery, Bluedart…"
            autoComplete="organization"
          />
        </ActionField>

        <ActionField name="tracking_number" label="Tracking Number (required)" state={state}>
          <input
            className="input"
            id="tracking_number"
            name="tracking_number"
            placeholder="AWB / consignment no."
            aria-invalid={Boolean(errorFor('tracking_number'))}
            aria-describedby={errorFor('tracking_number') ? 'tracking_number-error' : undefined}
          />
        </ActionField>
      </div>

      <div className="row">
        <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Record fulfillment'}
        </button>
        <span className="helper">A successful save marks the order fulfilled.</span>
      </div>
    </form>
  );
}
