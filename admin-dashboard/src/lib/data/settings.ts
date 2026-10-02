import 'server-only';

import type { AdminAuditLog, AdminUser } from '@yord/db-types';
import { clampPage, pageRange, sanitizeSearch } from '@/lib/pagination';
import type { ServerClient } from '@/lib/supabase/server';
import { one, reader, rows, runCount, runPage, type Paged } from './client';

/**
 * Admin users, the audit trail, and the identities behind both.
 *
 * These tables are default-deny under RLS (sql/003_admin_rls.sql), so every
 * read here uses the service client — which is why these reads are not
 * reachable by the session client.
 */

// ─── Admin users ──────────────────────────────────────────────────────────────

export async function listAdmins(): Promise<AdminUser[]> {
  const service = await reader({ service: true });
  return rows<AdminUser>(
    'admin_users',
    service.from('admin_users').select('*').order('created_at', { ascending: false }),
  );
}

/** The signed-in admin's id, for the "you" marker on their own row. */
export async function getCurrentAdminId(): Promise<string | null> {
  try {
    const supabase = await reader();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch (error) {
    // Presentation only: the page still renders without the marker, and the
    // action re-checks the caller regardless (see `requireAdminAction`).
    console.error('[settings] could not read the signed-in admin', error);
    return null;
  }
}

/** What an `auth.users` id resolves to, when it resolves at all. */
export interface AdminIdentity {
  email: string | null;
  name: string | null;
}

/**
 * How many `auth.users` rows one list page holds, how many pages the crawl will
 * read, and how many exact-id lookups it may fall back to. All three are caps,
 * not targets: the crawl stops the moment every requested id is accounted for,
 * and a normal admin table is one page of work.
 */
const IDENTITY_PAGE_SIZE = 200;
const IDENTITY_MAX_PAGES = 3;
const IDENTITY_MAX_LOOKUPS = 25;

/** First non-empty display-name field on the auth user, if it carries one. */
function userDisplayName(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const metadata = user.user_metadata ?? {};
  for (const key of ['full_name', 'name', 'display_name']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Resolve `user_id` uuids to emails/names, keyed both exactly and lowercased.
 *
 * `admin_users.user_id` and `admin_audit_log.actor_id` are both ids from
 * `auth.users`, and neither table can be joined to `auth.users` through
 * PostgREST — generated types keep the `auth` schema out of the public API. The
 * service client already backs the two reads above, so its admin API is the one
 * place this mapping can come from, server-side.
 *
 * Two phases, both bounded: a list crawl (the cheap bulk path — one request for
 * a small auth table) and, for whatever it did not cover, an exact `getUserById`
 * per remaining id. The second phase matters because the storefront's own
 * customers live in `auth.users` too: on a store with thousands of accounts, the
 * crawl's page window can sit entirely on accounts that are not admins, and an
 * admin added this morning would never resolve.
 *
 * Never throws. A missing user (deleted account), a failed call, or an
 * unconfigured key all come back as an empty/partial `Map`, and the callers fall
 * back to a truncated UUID with a log line. A cosmetic label is not worth
 * blanking the page — the error model's own rule (`lib/data/client.ts`) is about
 * reads whose *results* the page renders.
 */
export async function resolveAdminIdentities(
  userIds: readonly string[],
): Promise<Map<string, AdminIdentity>> {
  const wanted = new Set<string>();
  for (const id of userIds) {
    const trimmed = id?.trim();
    if (trimmed) wanted.add(trimmed.toLowerCase());
  }

  const identities = new Map<string, AdminIdentity>();
  if (wanted.size === 0) return identities;

  // Keyed both ways: uuids are case-insensitive in Postgres and the two tables
  // carrying one are not guaranteed to agree on casing.
  const found = new Set<string>();
  const record = (user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }) => {
    const lower = user.id.toLowerCase();
    if (!wanted.has(lower) || found.has(lower)) return;
    const identity: AdminIdentity = { email: user.email ?? null, name: userDisplayName(user) };
    identities.set(user.id, identity);
    identities.set(lower, identity);
    found.add(lower);
  };

  let service: ServerClient;
  try {
    service = await reader({ service: true });
  } catch (error) {
    console.error('[settings] no service client for identity resolution', error);
    return identities;
  }

  try {
    for (let page = 1; page <= IDENTITY_MAX_PAGES; page += 1) {
      const { data, error } = await service.auth.admin.listUsers({
        page,
        perPage: IDENTITY_PAGE_SIZE,
      });
      if (error) throw error;
      for (const user of data.users) record(user);
      if (found.size >= wanted.size || !data.nextPage) break;
    }
  } catch (error) {
    console.error('[settings] could not list auth users for identity resolution', error);
  }

  const missing = [...wanted].filter((id) => !found.has(id)).slice(0, IDENTITY_MAX_LOOKUPS);
  if (missing.length > 0) {
    // Exact lookups only for the ids the crawl missed, so the common path stays
    // one request. Parallel and individually guarded: one dead account must not
    // take the rest of the page's labels down with it.
    const users = await Promise.all(
      missing.map(async (id) => {
        try {
          const { data, error } = await service.auth.admin.getUserById(id);
          if (error) return null;
          return data.user ?? null;
        } catch (error) {
          console.error(`[settings] could not resolve auth user ${id}`, error);
          return null;
        }
      }),
    );
    for (const user of users) if (user) record(user);
  }

  return identities;
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

/** Rows per audit page. */
export const AUDIT_PAGE_SIZE = 20;

/** Longest `action` / `entity` value honoured from the query string. */
const FILTER_VALUE_MAX = 80;

/**
 * Audit filters. Every field is optional, so the previous `{ page, pageSize }`
 * call sites keep working unchanged.
 */
export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  /** Case-insensitive match against `action`, `entity`, or `entity_id`. */
  q?: string;
  /** Exact `action` match, normally a value from `listAuditFacets()`. */
  action?: string;
  /** Exact `entity` match. */
  entity?: string;
}

/** Paged audit log (was `.limit(20)` with no pager). */
export async function listAuditLog(filters: AuditLogFilters): Promise<Paged<AdminAuditLog>> {
  const service = await reader({ service: true });
  const pageSize = filters.pageSize ?? AUDIT_PAGE_SIZE;
  const page = clampPage(filters.page);
  const { from, to } = pageRange(page, pageSize);

  let request = service
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const search = sanitizeSearch(filters.q);
  if (search) {
    // `.or()` takes PostgREST filter syntax, so the term goes through
    // `sanitizeSearch` (which strips its separators) before it is interpolated.
    request = request.or(
      `action.ilike.%${search}%,entity.ilike.%${search}%,entity_id.ilike.%${search}%`,
    );
  }

  const action = filters.action?.trim().slice(0, FILTER_VALUE_MAX);
  if (action) request = request.eq('action', action);

  const entity = filters.entity?.trim().slice(0, FILTER_VALUE_MAX);
  if (entity) request = request.eq('entity', entity);

  const result = await runPage<AdminAuditLog>('admin_audit_log', request);
  return { rows: result.rows, count: result.count, page, pageSize };
}

/** How many recent entries the facet scan reads. */
const FACET_SCAN = 500;
/** Most options either filter gets. */
const FACET_CAP = 30;

/**
 * Distinct `action` / `entity` values for the two filter selects.
 *
 * PostgREST cannot `SELECT DISTINCT`, so this is one bounded scan of the newest
 * {@link FACET_SCAN} entries with two columns, de-duplicated in memory and
 * capped alphabetically. A value that has not been written in the last 500
 * entries is therefore not offered as a filter option — it is still reachable
 * through the free-text search, which is why the search matches both columns.
 */
export async function listAuditFacets(): Promise<{ actions: string[]; entities: string[] }> {
  const service = await reader({ service: true });
  const scanned = await rows<Pick<AdminAuditLog, 'action' | 'entity'>>(
    'admin_audit_log',
    service
      .from('admin_audit_log')
      .select('action, entity')
      .order('created_at', { ascending: false })
      .limit(FACET_SCAN),
  );

  const distinct = (pick: (row: Pick<AdminAuditLog, 'action' | 'entity'>) => string): string[] => {
    const values = new Set<string>();
    for (const row of scanned) {
      const value = pick(row).trim();
      if (value) values.add(value);
    }
    return [...values].sort().slice(0, FACET_CAP);
  };

  return { actions: distinct((row) => row.action), entities: distinct((row) => row.entity) };
}

/** The four numbers the settings stat strip shows. */
export interface SettingsStats {
  activeAdmins: number;
  deactivatedAdmins: number;
  /** Every row in `admin_audit_log`. */
  auditEntries: number;
  /** `created_at` of the newest entry, or null when the log is empty. */
  lastWriteAt: string | null;
}

/**
 * Stat strip behind `/settings`.
 *
 * The admin counts are derived from the `admins` the page already read (no
 * second query for rows we hold), and the two audit numbers are one head-only
 * count plus one bounded single row — nothing here scales with the log.
 */
export async function getSettingsStats(admins: readonly AdminUser[]): Promise<SettingsStats> {
  const service = await reader({ service: true });

  const [auditEntries, latest] = await Promise.all([
    runCount(
      'admin_audit_log',
      service.from('admin_audit_log').select('id', { count: 'exact', head: true }),
    ),
    one<Pick<AdminAuditLog, 'created_at'>>(
      'admin_audit_log',
      service
        .from('admin_audit_log')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  const activeAdmins = admins.filter((admin) => admin.is_active === true).length;

  return {
    activeAdmins,
    deactivatedAdmins: admins.length - activeAdmins,
    auditEntries,
    lastWriteAt: latest?.created_at ?? null,
  };
}
