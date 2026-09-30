import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@yord/db-types';
import type { z } from 'zod';
import type { ActionState } from '@/lib/action-state';
import { actionError, actionFieldErrors, actionOk } from '@/lib/action-state';
import { DatabaseError, ForbiddenError } from '@/lib/errors';
import { logAudit } from '@/lib/utils/audit';
import { requireAdminAction, type AdminSession } from '@/lib/utils/admin';

/**
 * Shared plumbing for every server action.
 *
 * Before this existed, 14 inline `'use server'` functions in page files each did
 * their own auth-free `.from()` write and returned nothing — an error was
 * discarded, the form re-rendered identically, and the admin concluded the save
 * worked. Each action now runs the same five steps:
 *
 *   1. `requireAdmin()` — the layout/middleware are defence in depth, not the
 *      authorization boundary for the write itself.
 *   2. Parse input with zod (one schema, shared with the client).
 *   3. Perform the write through the service client.
 *   4. `logAudit()` — never fatal.
 *   5. Return an `ActionState` so the form can show field errors, a banner, or
 *      a success message. No action returns `undefined`.
 */

/** A zod schema's flattened field errors. */
export type FieldErrors = Record<string, string[]>;

export interface ActionContext {
  /** The authenticated admin. */
  user: { id: string; email?: string };
  /** Service-role client: bypasses RLS, safe because `requireAdmin` just ran. */
  service: SupabaseClient<Database>;
  /** Session-scoped anon client, when the action needs the caller's own RLS. */
  supabase: SupabaseClient<Database>;
}

/**
 * Wrap an action body: authenticate, convert any throw into a form-level error.
 *
 * `ForbiddenError` becomes a clear "not authorized" message rather than a 500,
 * because it is a real possibility when a session expires between page load and
 * submit.
 */
export async function withAdmin<T = undefined>(
  action: (context: ActionContext) => Promise<ActionState<T>>,
): Promise<ActionState<T>> {
  try {
    const session: AdminSession = await requireAdminAction();
    return await action({
      user: { id: session.user.id, email: session.user.email },
      service: session.service,
      supabase: session.supabase,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return actionError(error.message);
    }
    if (error instanceof DatabaseError) {
      console.error(`[action] database failure on ${error.entity}:`, error.message);
      return actionError('The database rejected that change. Nothing was saved.');
    }
    if (isRedirect(error)) throw error;
    console.error('[action] unexpected failure:', error);
    return actionError('Something went wrong. Nothing was saved.');
  }
}

/**
 * `redirect()` throws a control-flow signal that must not be caught and turned
 * into a form error. Detected by its `digest` prefix.
 */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

/**
 * Parse `FormData` against a zod schema.
 *
 * Handing the schema a plain object (not the FormData itself) means the same
 * schema validates `<form>` submissions and the client's `safeParse` hint text,
 * since both work on field/value pairs.
 *
 * Note for repeated fields: `Object.fromEntries` keeps only the LAST value for a
 * duplicated key, so a schema cannot see a multi-valued `<input name="ids">`
 * (or a `getAll`-style multi-select). No current schema depends on that — the
 * one place that needs repeats, `bulkUpdateProductStatusAction`, reads
 * `formData.getAll('ids')` directly instead of going through here. A future
 * schema that does need repeats must read `getAll` itself; extending this helper
 * to return all values would be the alternative.
 */
export function parseForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  formData: FormData,
):
  | { ok: true; data: z.output<TSchema> }
  | { ok: false; state: ActionState<never> } {
  const result = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!result.success) {
    // zod types `flatten().fieldErrors` as optional-valued; drop empty arrays so
    // the UI only renders messages that actually exist.
    const flattened = result.error.flatten().fieldErrors as Record<
      string,
      string[] | undefined
    >;
    const fieldErrors: FieldErrors = {};
    for (const [field, messages] of Object.entries(flattened)) {
      if (messages?.length) fieldErrors[field] = messages;
    }
    return {
      ok: false,
      state: actionFieldErrors(fieldErrors),
    };
  }
  return { ok: true, data: result.data };
}

/** One audit entry per action, always after the write has committed. */
export async function audit(
  context: ActionContext,
  entry: {
    action: string;
    entity: string;
    entityId: number | string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await logAudit({
    actorId: context.user.id,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
  });
}

export { actionError, actionOk, actionFieldErrors };
