'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateOrderStatusAction } from '@/server/actions/orders';
import { FINANCIAL_STATUSES, FULFILLMENT_STATUSES } from '@/lib/constants';

/**
 * Order status editor.
 *
 * The old inline action validated the two statuses by hand and `return`ed on any
 * database error. `orderStatusSchema` is the same validation the list filters
 * use, so a status that is not in the constants list is rejected before the
 * write, and the write's failure now reaches the admin.
 */
export default function OrderStatusForm({
  orderId,
  financialStatus,
  fulfillmentStatus,
}: {
  orderId: number;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
}) {
  const { state, pending, formAction, errorFor } = useActionForm(updateOrderStatusAction);

  return (
    <form action={formAction} className="form-grid" noValidate>
      <input type="hidden" name="order_id" value={orderId} />

      <FormError state={state} />

      <ActionField name="financial_status" label="Financial Status" state={state}>
        <select
          className="select"
          id="financial_status"
          name="financial_status"
          defaultValue={financialStatus || 'pending'}
          aria-invalid={Boolean(errorFor('financial_status'))}
        >
          {FINANCIAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </ActionField>

      <ActionField name="fulfillment_status" label="Fulfillment Status" state={state}>
        <select
          className="select"
          id="fulfillment_status"
          name="fulfillment_status"
          defaultValue={fulfillmentStatus || 'unfulfilled'}
          aria-invalid={Boolean(errorFor('fulfillment_status'))}
        >
          {FULFILLMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </ActionField>

      <button className="button primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Status'}
      </button>
    </form>
  );
}
