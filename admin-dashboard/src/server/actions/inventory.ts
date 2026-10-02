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
    // Reject a missing/non-string quantity BEFORE zod coercion: an omitted
    // field or an empty string would otherwise normalize to 0 (`Number('')`
    // is 0) and silently zero the variant's stock. Only an explicit integer
    // string passes; the schema then enforces int >= 0.
    const rawQuantity = formData.get('inventory_quantity');
    if (typeof rawQuantity !== 'string' || !/^\d+$/.test(rawQuantity.trim())) {
      return actionError('Invalid quantity.');
    }
    const parsed = parseForm(inventoryUpdateSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const { data: before, error: readError } = await context.service
      .from('product_variants')
      .select('id, product_id, inventory_quantity')
      .eq('id', input.variant_id)
      .maybeSingle();
    // A failed lookup is a server-side problem, not a bad quantity: report it
    // as one so an outage is not misread as a validation error.
    if (readError) {
      console.error('[inventory] variant lookup failed', input.variant_id, readError);
      return actionError('Could not load that variant. Nothing was saved.');
    }
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
