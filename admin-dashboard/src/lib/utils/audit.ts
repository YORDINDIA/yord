import type { JsonValue } from '@yord/db-types';
import type { ServerClient } from '@/lib/supabase/server';

interface AuditParams {
  actorId: string;
  action: string;
  entity: string;
  entityId: number | string;
  before?: unknown;
  after?: unknown;
}

/**
 * Append a row to admin_audit_log.
 *
 * Never throws. A failed audit write must not roll back (or appear to roll
 * back) a business write that already committed: the old implementation threw,
 * so a transient admin_audit_log failure turned a successful product create
 * into a 500 and the admin retried, creating duplicates. Failures are logged
 * loudly instead — `console.error` with entity/id — so they are greppable in
 * server logs and PostHog, while the mutation's own result stands.
 *
 * `admin_audit_log` is default-deny under RLS (sql/003_admin_rls.sql), so this
 * must go through the service client.
 */
export async function logAudit({
  actorId,
  action,
  entity,
  entityId,
  before,
  after,
}: AuditParams): Promise<boolean> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase: ServerClient = createServiceClient();
    const { error } = await supabase.from('admin_audit_log').insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: String(entityId),
      before: (before ?? null) as JsonValue,
      after: (after ?? null) as JsonValue,
    });
    if (error) {
      console.error(
        `[audit] FAILED to record ${action} on ${entity}#${entityId} by ${actorId}:`,
        error.message,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[audit] THREW while recording ${action} on ${entity}#${entityId} by ${actorId}:`,
      error,
    );
    return false;
  }
}
