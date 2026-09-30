'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { isUniqueViolation } from '@/lib/errors';
import { getNextId } from '@/lib/utils/ids';
import { discountSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/**
 * Create a price rule plus its code.
 *
 * The old inline action threw on either failure, so a failed rule insert left a
 * dangling row with no message. On a code failure the rule is now rolled back
 * explicitly, and the reason is reported.
 */
export async function createDiscountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ id: number }>> {
  return withAdmin<{ id: number }>(async (context) => {
    const parsed = parseForm(discountSchema, formData);
    if (!parsed.ok) return parsed.state;
    const input = parsed.data;

    const [ruleId, codeId] = await Promise.all([
      getNextId('price_rules'),
      getNextId('discount_codes'),
    ]);
    const now = new Date().toISOString();
    const startsAt = input.starts_at ? new Date(input.starts_at).toISOString() : now;
    const endsAt = input.ends_at ? new Date(input.ends_at).toISOString() : null;

    const { error: ruleError } = await context.service.from('price_rules').insert({
      id: ruleId,
      title: input.title,
      value: input.value,
      value_type: input.value_type,
      customer_selection: 'all',
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      once_per_customer: false,
      starts_at: startsAt,
      ends_at: endsAt,
      created_at: now,
      updated_at: now,
    });
    if (ruleError) {
      console.error('[discounts] price_rules insert failed', ruleError);
      return actionError('Could not create the discount.');
    }

    const { error: codeError } = await context.service.from('discount_codes').insert({
      id: codeId,
      price_rule_id: ruleId,
      code: input.code.toUpperCase(),
      created_at: now,
      updated_at: now,
    });
    if (codeError) {
      console.error('[discounts] discount_codes insert failed', codeError);
      // Roll back the rule so a failed creation leaves nothing behind.
      await context.service.from('price_rules').delete().eq('id', ruleId);
      if (isUniqueViolation(codeError)) {
        return actionError('That discount code already exists.');
      }
      return actionError('Could not create the discount code. Nothing was saved.');
    }

    await audit(context, {
      action: 'create',
      entity: 'price_rules',
      entityId: ruleId,
      after: { title: input.title, code: input.code, value: input.value, value_type: input.value_type },
    });

    revalidatePath('/discounts');
    return actionOk<{ id: number }>(`Discount ${input.code.toUpperCase()} created.`, { id: ruleId });
  });
}
