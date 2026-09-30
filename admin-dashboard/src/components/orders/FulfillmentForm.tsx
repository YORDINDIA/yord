'use client';

import { useRef } from 'react';
import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { addFulfillmentAction } from '@/server/actions/orders';
import { formatDate } from '@/lib/utils/format';
import type { Fulfillment } from '@yord/db-types';

/**
 * Add-a-fulfillment form plus the order's fulfillment history.
 *
 * The old inline action required a tracking number by hand and returned early
 * for any insert error; the tracking row is now written by
 * `addFulfillmentAction`, which also reports the partial-failure case where the
 * tracking row lands but the order status flip does not.
 */
export default function FulfillmentForm({
  orderId,
  fulfillments,
}: {
  orderId: number;
  fulfillments: Fulfillment[];
}) {
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
    <>
      <form
        ref={formRef}
        action={formAction}
        className="form-grid"
        noValidate
        style={{ marginBottom: fulfillments.length > 0 ? 16 : 0 }}
      >
        <input type="hidden" name="order_id" value={orderId} />

        <FormError state={state} />

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

        <button className="button" type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Saving…' : 'Add Fulfillment'}
        </button>
      </form>

      {fulfillments.length === 0 ? (
        <span className="helper">No fulfillments yet.</span>
      ) : (
        <div className="helper" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fulfillments.map((fulfillment) => (
            <div key={fulfillment.id}>
              #{fulfillment.id} · {fulfillment.tracking_company || 'Carrier n/a'} ·{' '}
              {fulfillment.tracking_number} · {formatDate(fulfillment.created_at)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
