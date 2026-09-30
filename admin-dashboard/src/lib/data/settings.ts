import 'server-only';

import type { AdminAuditLog, AdminUser } from '@yord/db-types';
import { clampPage, pageRange } from '@/lib/pagination';
import { reader, rows, runPage, type Paged } from './client';

/**
 * Admin users and the audit log.
 *
 * These tables are default-deny under RLS (sql/003_admin_rls.sql), so every
 * read here uses the service client — which is why these reads are not
 * reachable by the session client.
 */
export async function listAdmins(): Promise<AdminUser[]> {
  const service = await reader({ service: true });
  return rows<AdminUser>(
    'admin_users',
    service.from('admin_users').select('*').order('created_at', { ascending: false }),
  );
}

/** Paged audit log (was `.limit(20)` with no pager). */
export async function listAuditLog(filters: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<AdminAuditLog>> {
  const service = await reader({ service: true });
  const pageSize = filters.pageSize ?? 20;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  const request = service
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return runPage<AdminAuditLog>('admin_audit_log', request).then((result) => ({
    ...result,
    page,
    pageSize,
  }));
}
