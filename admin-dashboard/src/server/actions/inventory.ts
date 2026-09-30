'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { inventoryUpdateSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/**
 * Per-row inventory quantity save.
 *
 * The previous inline action was the only one of the 14 that returned
 * `{ error }`, and it is the shape `ActionState` generalizes: the stepper now
 * reads `formError` instead of a bespoke `error` field.
 */
export async function updateInventoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(inventoryUpdateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('product_variants')
      .select('id, product_id, inventory_quantity')
      .eq('id', input.variant_id)
      .maybeSingle();
    if (readError) return actionError('Invalid quantity.');
    if (!before) return actionError('That variant no longer exists.');

    const { error } = await context.service
      .from('product_variants')
      .update({ inventory_quantity: input.inventory_quantity, updated_at: new Date().toISOString() })
      .eq('id', input.variant_id);
    if (error) {
      console.error('[inventory] update failed', input.variant_id, error);
      return actionError('Could not save inventory.');
    }

    await audit(context, {
      action: 'update_inventory',
      entity: 'product_variants',
      entityId: input.variant_id,
      before,
      after: { inventory_quantity: input.inventory_quantity },
    });

    revalidatePath('/inventory');
    revalidatePath(`/products/${before.product_id}`);
    return actionOk('Inventory saved.');
  });
}
