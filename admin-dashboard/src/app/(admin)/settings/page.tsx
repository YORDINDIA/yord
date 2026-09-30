import type { Metadata } from 'next';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import AdminUsersPanel from '@/components/settings/AdminUsersPanel';
import { listAdmins, listAuditLog } from '@/lib/data/settings';
import { firstParam, pageCount } from '@/lib/pagination';
import { formatDate } from '@/lib/utils/format';
import type { AdminAuditLog } from '@yord/db-types';

export const metadata: Metadata = { title: 'Settings · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Admin users and the audit log.
 *
 * Both reads were issued through `createServiceClient()` directly in the page
 * and their results were cast to inline object types that did not match the
 * table, so a schema change surfaced as a type error rather than a coherent read.
 * The audit log was `.limit(20)` with no pager, so entries past the twentieth
 * were unreachable; it is paged now.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const [audit, admins] = await Promise.all([
    listAuditLog({ page: Number(firstParam(resolved?.page)) || 1 }),
    listAdmins(),
  ]);

  const auditColumns: DataTableColumn<AdminAuditLog>[] = [
    { key: 'action', header: 'Action', render: (entry) => entry.action },
    {
      key: 'entity',
      header: 'Entity',
      render: (entry) => (
        <span className="helper">
          {entry.entity} {entry.entity_id}
        </span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (entry) => formatDate(entry.created_at),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Admin Users</div>
            <div className="helper">
              Deactivate instead of delete. You cannot deactivate yourself.
            </div>
          </div>
        </div>
        <AdminUsersPanel admins={admins} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Audit Log</div>
            <div className="helper">
              {audit.count} recorded action(s) · page {audit.page} of{' '}
              {pageCount(audit.count, audit.pageSize)}
            </div>
          </div>
        </div>
        <DataTable
          caption="Audit log"
          columns={auditColumns}
          rows={audit.rows}
          rowKey={(entry) => entry.id}
          emptyTitle="No audit entries"
          emptyHint="Admin writes show up here once they commit."
        />
        <Pagination
          basePath="/settings"
          params={{}}
          page={audit.page}
          pageSize={audit.pageSize}
          total={audit.count}
          shown={audit.rows.length}
          label="entries"
        />
      </div>
    </div>
  );
}
