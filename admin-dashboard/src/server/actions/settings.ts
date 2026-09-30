'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { isUniqueViolation } from '@/lib/errors';
import { adminUserSchema, toggleAdminSchema } from '@/lib/validation';
import { audit, parseForm, withAdmin } from './_shared';

/**
 * Admin user management.
 *
 * `admin_users` is default-deny under RLS (sql/003_admin_rls.sql), so these
 * writes go through the service client that `requireAdmin` hands back — the
 * anon client can read the caller's own row and nothing else.
 */
export async function addAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(adminUserSchema, formData);
    if (!parsed.ok) return parsed.state;

    const { error } = await context.service.from('admin_users').insert({
      user_id: parsed.data.user_id,
      role: 'admin',
      is_active: true,
    });
    if (error) {
      console.error('[settings] admin insert failed', error);
      if (isUniqueViolation(error)) {
        return actionError('That user is already an admin.');
      }
      return actionError('Could not add the admin. Check the UUID and try again.');
    }

    await audit(context, {
      action: 'add_admin',
      entity: 'admin_users',
      entityId: parsed.data.user_id,
      after: { user_id: parsed.data.user_id, role: 'admin' },
    });

    revalidatePath('/settings');
    return actionOk('Admin added.');
  });
}

export async function toggleAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return withAdmin(async (context) => {
    const parsed = parseForm(toggleAdminSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { user_id: userId, is_active: isActive } = parsed.data;

    // Self-deactivation would lock the acting admin out mid-session.
    if (userId === context.user.id) {
      return actionError('You cannot deactivate your own account.');
    }

    const { data: target, error: readError } = await context.service
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) return actionError('Could not load that admin.');
    if (!target) return actionError('That admin no longer exists.');

    const nextActive = !isActive;
    const { error } = await context.service
      .from('admin_users')
      .update({ is_active: nextActive })
      .eq('user_id', userId);
    if (error) {
      console.error('[settings] admin toggle failed', error);
      return actionError('Could not update that admin.');
    }

    await audit(context, {
      action: nextActive ? 'activate_admin' : 'deactivate_admin',
      entity: 'admin_users',
      entityId: userId,
      before: target,
      after: { is_active: nextActive },
    });

    revalidatePath('/settings');
    return actionOk(nextActive ? 'Admin reactivated.' : 'Admin deactivated.');
  });
}
