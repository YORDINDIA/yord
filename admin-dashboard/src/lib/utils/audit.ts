import { createServiceClient } from '@/lib/supabase/server';

interface AuditParams {
  actorId: string;
  action: string;
  entity: string;
  entityId: number | string;
  before?: unknown;
  after?: unknown;
}

export async function logAudit({ actorId, action, entity, entityId, before, after }: AuditParams) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('admin_audit_log').insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: String(entityId),
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
  if (error) throw new Error(error.message);
}
