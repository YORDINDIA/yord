import type { Metadata } from 'next';
import clsx from 'clsx';
import {
  Clock,
  ScrollText,
  SearchX,
  Settings,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from 'lucide-react';
import type { AdminAuditLog } from '@yord/db-types';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import FilterBar, { FilterSelect } from '@/components/data/FilterBar';
import Pagination from '@/components/data/Pagination';
import { formatDateTime, relativeTime } from '@/components/orders/format';
import AddAdminForm from '@/components/settings/AddAdminForm';
import AdminUsersPanel from '@/components/settings/AdminUsersPanel';
import AuditDetailButton from '@/components/settings/AuditDetailButton';
import {
  actorSeed,
  actorSubtitle,
  actorTitle,
  indexIdentity,
  shortId,
  type ActorIdentity,
  type IdentityIndex,
} from '@/components/settings/format';
import settingsStyles from '@/components/settings/settings.module.css';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import {
  getCurrentAdminId,
  getSettingsStats,
  listAdmins,
  listAuditFacets,
  listAuditLog,
  resolveAdminIdentities,
} from '@/lib/data/settings';
import { firstParam, pageCount } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Settings · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

const AUDIT_TAB = 'audit';
const EMPTY_FACETS = { actions: [] as string[], entities: [] as string[] };

/**
 * Admin access and the audit trail.
 *
 * Two surfaces, one route, URL-driven (`?tab=audit`): both are reachable, both
 * are linkable, and the browser's own back button moves between them. Only one
 * table is paginated, so the pager writes a plain `page` — there is no second
 * `*_page` parameter to keep in step.
 *
 * Every read comes from `lib/data/settings.ts`, which is `server-only` and is the
 * only module that touches the service client. In particular the `user_id →
 * email` mapping both tables display is resolved there: the service key exists so
 * the *server* can read `auth.users`, never so the browser can.
 *
 * Identity resolution is best-effort by design. It returns a partial map instead
 * of throwing, and every cell falls back to a truncated mono uuid — a label is
 * not worth replacing the page with an error boundary. Nothing else degrades: a
 * failed admin or audit read still throws, which is the error model.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const tab = firstParam(resolved.tab) === AUDIT_TAB ? AUDIT_TAB : 'admins';
  const q = firstParam(resolved.q)?.trim() || undefined;
  const action = firstParam(resolved.action)?.trim() || undefined;
  const entity = firstParam(resolved.entity)?.trim() || undefined;
  const page = Number(firstParam(resolved.page)) || 1;
  const filtering = Boolean(q || action || entity);

  const [admins, currentAdminId] = await Promise.all([listAdmins(), getCurrentAdminId()]);

  // `getSettingsStats` counts the admins already in hand, so it costs one
  // head-only count and one bounded row — never a second crawl of the list.
  const [stats, audit, facets] = await Promise.all([
    getSettingsStats(admins),
    tab === AUDIT_TAB ? listAuditLog({ page, q, action, entity }) : null,
    tab === AUDIT_TAB ? listAuditFacets() : EMPTY_FACETS,
  ]);

  // One lookup for both surfaces; `Map` does not cross the server/client
  // boundary, so it is flattened to the plain object the panels receive. The
  // client panel gets only the admins' slice — the audit actors' labels are
  // rendered on this side of the boundary and never need to be shipped.
  const identityIndex: IdentityIndex = Object.fromEntries(
    await resolveAdminIdentities([
      ...admins.map((admin) => admin.user_id),
      ...(audit?.rows ?? []).map((entry) => entry.actor_id),
    ]),
  );
  const adminIdentities = pickIdentities(
    identityIndex,
    admins.map((admin) => admin.user_id),
  );

  return (
    <>
      <PageHeader
        icon={Settings}
        tone="slate"
        title="Settings"
        description="Admins, access, and the audit trail."
        tabs={
          <Tabs
            items={[
              {
                key: 'admins',
                label: 'Administrators',
                href: '/settings',
                icon: UserCog,
                count: admins.length,
              },
              {
                key: AUDIT_TAB,
                label: 'Audit trail',
                href: '/settings?tab=audit',
                icon: ScrollText,
                count: stats.auditEntries,
              },
            ]}
            active={tab}
            ariaLabel="Settings views"
          />
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Active admins"
          value={stats.activeAdmins}
          icon={ShieldCheck}
          tone="emerald"
          hint="Can sign in and write"
        />
        <StatCard
          label="Deactivated"
          value={stats.deactivatedAdmins}
          icon={ShieldOff}
          tone="slate"
          hint="No access, history kept"
        />
        <StatCard
          label="Audit entries"
          value={stats.auditEntries}
          icon={ScrollText}
          tone="blue"
          hint="Every recorded write"
        />
        <StatCard
          label="Last write"
          value={stats.lastWriteAt ? relativeTime(stats.lastWriteAt) : 'None yet'}
          icon={Clock}
          tone="slate"
          valueSm
          hint={stats.lastWriteAt ? formatDateTime(stats.lastWriteAt) : 'The log is empty'}
        />
      </div>

      {tab === AUDIT_TAB && audit ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="section-title">Audit trail</h2>
              <p className="helper">
                {stats.auditEntries} recorded action(s) · page {audit.page} of{' '}
                {pageCount(audit.count, audit.pageSize)} · newest first. Actor emails come from
                Supabase Auth; a deleted account falls back to its id.
              </p>
            </div>
          </div>

          <FilterBar>
            {/* FilterBar rebuilds the query string from its own fields, so the
                tab has to be a field — otherwise applying a filter drops the
                admin back on the other surface. `page` is deliberately absent:
                a filtered result set has no page 3. */}
            <input type="hidden" name="tab" value={AUDIT_TAB} />
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search action, entity, or id"
              aria-label="Search the audit trail by action, entity, or entity id"
            />
            <FilterSelect
              name="action"
              label="Filter by action"
              value={action ?? 'all'}
              options={facetOptions(facets.actions, action, 'All actions', (value) =>
                value.replace(/_/g, ' '),
              )}
            />
            <FilterSelect
              name="entity"
              label="Filter by entity"
              value={entity ?? 'all'}
              options={facetOptions(facets.entities, entity, 'All entities', (value) => value)}
            />
          </FilterBar>

          {audit.rows.length === 0 ? (
            filtering ? (
              <EmptyState
                icon={<SearchX size={22} aria-hidden />}
                tone="amber"
                title="No entries match these filters"
                hint="The search matches the action, the entity, and the entity id. Clear the filters to see the whole log."
                actionLabel="Clear filters"
                actionHref="/settings?tab=audit"
              />
            ) : audit.count === 0 ? (
              <EmptyState
                icon={<ScrollText size={22} aria-hidden />}
                tone="slate"
                title="Nothing has been written yet"
                hint="Every audited write lands here the moment it commits — status changes, refunds, media uploads, and admin access."
                secondaryAction={{ label: 'Manage administrators', href: '/settings' }}
              />
            ) : (
              // A successful read with rows in it, on a page past the end —
              // "no results" would be a lie here, and the pager below already
              // says the same thing in one line.
              <EmptyState
                icon={<ScrollText size={22} aria-hidden />}
                tone="slate"
                title="This page is past the end of the log"
                hint={`There are ${audit.count} entries across ${pageCount(audit.count, audit.pageSize)} pages, and page ${audit.page} is empty.`}
                actionLabel="Back to the newest entries"
                actionHref="/settings?tab=audit"
              />
            )
          ) : (
            <DataTable
              caption="Audit log"
              columns={auditColumns(identityIndex)}
              rows={audit.rows}
              rowKey={(entry) => entry.id}
              leading={(entry) => {
                const actor = actorOf(entry, identityIndex);
                return <Avatar size="sm" name={actor.actorName} email={actorSeed(actor)} />;
              }}
            />
          )}

          <Pagination
            basePath="/settings"
            params={{ tab: AUDIT_TAB, q, action, entity }}
            page={audit.page}
            pageSize={audit.pageSize}
            total={audit.count}
            shown={audit.rows.length}
            label="entries"
          />
        </div>
      ) : (
        <>
          <div className="card">
            <AdminUsersPanel
              admins={admins}
              identityIndex={adminIdentities}
              currentAdminId={currentAdminId}
            />
          </div>
          <div className="card">
            <AddAdminForm />
          </div>
        </>
      )}
    </>
  );
}

/** The audit table's columns, with the actor resolved to a person where possible. */
function auditColumns(index: IdentityIndex): DataTableColumn<AdminAuditLog>[] {
  return [
    {
      key: 'actor',
      header: 'Actor',
      render: (entry) => {
        const actor = actorOf(entry, index);
        const subtitle = actorSubtitle(actor);
        return (
          <div className={settingsStyles.identity}>
            <div className="cell-title truncate" title={actor.actor_id}>
              {actorTitle(actor)}
            </div>
            <div className={clsx('cell-sub', !subtitle && 'mono', 'truncate')} title={actor.actor_id}>
              {subtitle ?? 'Not in auth.users'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (entry) => <span className="mono">{entry.action}</span>,
    },
    {
      key: 'entity',
      header: 'Entity',
      hideOnTablet: true,
      render: (entry) => (
        <div className={settingsStyles.identity}>
          <div className="cell-title truncate">{entry.entity}</div>
          <div className="cell-sub mono truncate" title={entry.entity_id}>
            {shortId(entry.entity_id, 12)}
          </div>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'When',
      render: (entry) => (
        <span className="num" title={formatDateTime(entry.created_at)}>
          {relativeTime(entry.created_at)}
        </span>
      ),
    },
    {
      key: 'payload',
      header: 'Payload',
      render: (entry) => {
        const actor = actorOf(entry, index);
        return (
          <AuditDetailButton
            action={entry.action}
            entity={entry.entity}
            entityId={entry.entity_id}
            actor={actorTitle(actor)}
            whenLabel={relativeTime(entry.created_at)}
            whenTitle={formatDateTime(entry.created_at)}
            before={entry.before}
            after={entry.after}
          />
        );
      },
    },
  ];
}

/** An audit row's actor id, plus whatever the identity lookup resolved for it. */
function actorOf(entry: AdminAuditLog, index: IdentityIndex): ActorIdentity {
  const identity = indexIdentity(index, entry.actor_id);
  return {
    actor_id: entry.actor_id,
    actorEmail: identity?.email ?? null,
    actorName: identity?.name ?? null,
  };
}

/**
 * The slice of the identity index belonging to these ids.
 *
 * Used for the props the client panel receives: email addresses are only ever
 * sent to the browser for people the panel actually renders.
 */
function pickIdentities(index: IdentityIndex, userIds: readonly string[]): IdentityIndex {
  const picked: IdentityIndex = {};
  for (const userId of userIds) {
    const identity = indexIdentity(index, userId);
    if (!identity) continue;
    picked[userId] = identity;
    picked[userId.toLowerCase()] = identity;
  }
  return picked;
}

/**
 * Filter options: the facet list, with the active value first when it is not in
 * the list. A value that has aged out of the facet scan would otherwise leave the
 * select showing "All" while the URL still filters on it.
 */
function facetOptions(
  values: readonly string[],
  current: string | undefined,
  allLabel: string,
  label: (value: string) => string,
): { value: string; label: string }[] {
  const options = [{ value: 'all', label: allLabel }];
  const seen = new Set<string>();
  for (const value of current ? [current, ...values] : values) {
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: label(value) });
  }
  return options;
}
