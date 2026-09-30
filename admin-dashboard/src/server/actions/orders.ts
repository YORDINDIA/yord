'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { getNextId } from '@/lib/utils/ids';
import { customerSchema, fulfillmentSchema, orderStatusSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/** Order, fulfillment, and customer-note mutations. */

export async function updateOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(orderStatusSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('orders')
      .select('financial_status, fulfillment_status')
      .eq('id', input.order_id)
      .maybeSingle();
    if (readError) return actionError('Could not load the order. Nothing was changed.');
    if (!before) return actionError('That order no longer exists.');

    const { error } = await context.service
      .from('orders')
      .update({
        financial_status: input.financial_status,
        fulfillment_status: input.fulfillment_status,
      })
      .eq('id', input.order_id);
    if (error) {
      console.error('[orders] status update failed', input.order_id, error);
      return actionError('Could not update the order status.');
    }

    await audit(context, {
      action: 'update_status',
      entity: 'orders',
      entityId: input.order_id,
      before,
      after: input,
    });

    revalidatePath(`/orders/${input.order_id}`);
    revalidatePath('/orders');
    return actionOk('Order status saved.');
  });
}

export async function addFulfillmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(fulfillmentSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: order } = await context.service
      .from('orders')
      .select('id')
      .eq('id', input.order_id)
      .maybeSingle();
    if (!order) return actionError('That order no longer exists.');

    const id = await getNextId('fulfillments');
    const now = new Date().toISOString();

    const { error } = await context.service.from('fulfillments').insert({
      id,
      order_id: input.order_id,
      status: 'success',
      tracking_company: input.tracking_company || null,
      tracking_number: input.tracking_number,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      console.error('[orders] fulfillment insert failed', error);
      return actionError('Could not save the fulfillment.');
    }

    // Recorded as a second, separately-logged write: if it fails, the tracking
    // row still exists and the admin sees a partial-failure message rather than
    // a silent "saved".
    const { error: statusError } = await context.service
      .from('orders')
      .update({ fulfillment_status: 'fulfilled' })
      .eq('id', input.order_id);
    if (statusError) {
      console.error('[orders] fulfillment_status update failed', statusError);
      return actionError(
        'Fulfillment saved, but the order status was not updated to "fulfilled".',
      );
    }

    await audit(context, {
      action: 'add_fulfillment',
      entity: 'fulfillments',
      entityId: id,
      after: { order_id: input.order_id, tracking_number: input.tracking_number },
    });

    revalidatePath(`/orders/${input.order_id}`);
    return actionOk('Fulfillment recorded.');
  });
}

export async function updateCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(customerSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('customers')
      .select('id, tags, note')
      .eq('id', input.id)
      .maybeSingle();
    if (readError) return actionError('Could not load the customer. Nothing was saved.');
    if (!before) return actionError('That customer no longer exists.');

    const { error } = await context.service
      .from('customers')
      .update({ tags: input.tags || null, note: input.note || null })
      .eq('id', input.id);
    if (error) {
      console.error('[customers] update failed', input.id, error);
      return actionError('Could not save the customer notes.');
    }

    await audit(context, {
      action: 'update',
      entity: 'customers',
      entityId: input.id,
      before,
      after: { tags: input.tags, note: input.note },
    });

    revalidatePath(`/customers/${input.id}`);
    revalidatePath('/customers');
    return actionOk('Customer saved.');
  });
}
