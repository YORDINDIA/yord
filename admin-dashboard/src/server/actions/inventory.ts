'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { inventoryUpdateSchema } from '@/lib/validation';
import { actionFieldErrors, audit, parseForm, withAdmin } from './_shared';

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

/**
 * Upper bound on variants one bulk adjustment may touch. The bar can only ever
 * submit the rows on the current page, so this is a guard against a hand-built
 * POST, not a UI limit.
 */
const MAX_BULK_IDS = 100;

/**
 * Set the same quantity on every selected variant.
 *
 * Kept separate from `updateInventoryAction` on purpose: that one is the
 * per-row save and its contract (one variant, one quantity, `before`/`after` in
 * the audit) is unchanged. This reads the current quantities first so the audit
 * entry has a real `before`, then writes all rows in one statement — a partial
 * outcome is impossible, which a loop of per-row updates could not promise.
 *
 * The submitted quantity goes through the same integer guard as the single-row
 * save (and then the same shared zod schema), because `z.coerce.number()` turns
 * an empty string into 0: without the guard, submitting the bar with no quantity
 * would silently zero every selected variant.
 */
export async function bulkAdjustInventoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const rawQuantity = formData.get('inventory_quantity');
    if (typeof rawQuantity !== 'string' || !/^\d+$/.test(rawQuantity.trim())) {
      return actionFieldErrors({
        inventory_quantity: ['Enter a whole quantity of 0 or more.'],
      });
    }
    const quantity = inventoryUpdateSchema.shape.inventory_quantity.safeParse(rawQuantity.trim());
    if (!quantity.success) {
      return actionFieldErrors({
        inventory_quantity: [quantity.error.issues[0]?.message ?? 'Invalid quantity.'],
      });
    }

    // `ids` is submitted as one hidden input per ticked row. Duplicates are
    // collapsed so the audit count matches what was written.
    const ids = [
      ...new Set(
        formData
          .getAll('ids')
          .map((value) => String(value).trim())
          .filter((value) => /^[1-9][0-9]*$/.test(value))
          .map(Number),
      ),
    ];
    if (ids.length === 0) return actionError('Select at least one variant first.');
    if (ids.length > MAX_BULK_IDS) {
      return actionError(`Adjust at most ${MAX_BULK_IDS} variants at a time.`);
    }

    const { data: before, error: readError } = await context.service
      .from('product_variants')
      .select('id, product_id, inventory_quantity')
      .in('id', ids);
    if (readError) {
      console.error('[inventory] bulk variant lookup failed', ids.length, readError);
      return actionError('Could not load those variants. Nothing was saved.');
    }
    if (!before || before.length === 0) return actionError('Those variants no longer exist.');

    const { data: updated, error } = await context.service
      .from('product_variants')
      .update({
        inventory_quantity: quantity.data,
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .select('id');
    if (error) {
      console.error('[inventory] bulk update failed', ids.length, error);
      return actionError(`Could not update ${ids.length} variant(s). Nothing was changed.`);
    }

    const written = updated?.length ?? 0;
    await audit(context, {
      action: 'bulk_adjust_inventory',
      entity: 'product_variants',
      entityId: ids.join(','),
      before: { variants: before },
      after: { inventory_quantity: quantity.data, variants: written },
    });

    revalidatePath('/inventory');
    // Each affected product page shows its own variants, so refresh those too.
    for (const productId of new Set(before.map((row) => row.product_id))) {
      revalidatePath(`/products/${productId}`);
    }

    return actionOk(
      written < ids.length
        ? `Set quantity to ${quantity.data} on ${written} variant(s); ${ids.length - written} no longer exist.`
        : `Set quantity to ${quantity.data} on ${written} variant(s).`,
    );
  });
}
