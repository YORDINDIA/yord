'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { updateOrderStatusAction } from '@/server/actions/orders';
import { FINANCIAL_STATUSES, FULFILLMENT_STATUSES, isOneOf } from '@/lib/constants';

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
  orderId: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
}) {
  const { state, pending, formAction, errorFor } = useActionForm(updateOrderStatusAction);

  // Imported orders can carry financial states outside the shared allowlist
  // (e.g. `authorized`, `partially_paid`). With no matching <option> the
  // select falls back to submitting `pending`, so saving any status silently
  // overwrites the financial one. Preserve an unsupported current value as an
  // extra option so the form round-trips it unchanged instead.
  const financialOptions: readonly string[] = isOneOf(FINANCIAL_STATUSES, financialStatus)
    ? FINANCIAL_STATUSES
    : financialStatus
      ? [...FINANCIAL_STATUSES, financialStatus]
      : FINANCIAL_STATUSES;
  const financialPreserved =
    financialStatus !== null && !isOneOf(FINANCIAL_STATUSES, financialStatus);
  const fulfillmentOptions: readonly string[] = isOneOf(FULFILLMENT_STATUSES, fulfillmentStatus)
    ? FULFILLMENT_STATUSES
    : fulfillmentStatus
      ? [...FULFILLMENT_STATUSES, fulfillmentStatus]
      : FULFILLMENT_STATUSES;
  const fulfillmentPreserved =
    fulfillmentStatus !== null && !isOneOf(FULFILLMENT_STATUSES, fulfillmentStatus);

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
          {financialOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {financialPreserved && (
          <div className="helper">
            Current status “{financialStatus}” is an imported value outside the standard list;
            it is preserved as-is unless you pick a replacement.
          </div>
        )}
      </ActionField>

      <ActionField name="fulfillment_status" label="Fulfillment Status" state={state}>
        <select
          className="select"
          id="fulfillment_status"
          name="fulfillment_status"
          defaultValue={fulfillmentStatus || 'unfulfilled'}
          aria-invalid={Boolean(errorFor('fulfillment_status'))}
        >
          {fulfillmentOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {fulfillmentPreserved && (
          <div className="helper">
            Current status “{fulfillmentStatus}” is an imported value outside the standard list;
            it is preserved as-is unless you pick a replacement.
          </div>
        )}
      </ActionField>

      <button className="button primary block" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Saving…' : 'Save Status'}
      </button>
    </form>
  );
}
