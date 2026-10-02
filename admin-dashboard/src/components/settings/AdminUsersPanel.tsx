'use client';

import clsx from 'clsx';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AdminUser } from '@yord/db-types';
import { Users } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import { useActionForm } from '@/components/forms/ActionForm';
import Avatar from '@/components/ui/Avatar';
import ConfirmModal from '@/components/ui/ConfirmModal';
import StatusBadge from '@/components/ui/StatusBadge';
import { toggleAdminAction } from '@/server/actions/settings';
import { formatDate } from '@/lib/utils/format';
import { indexIdentity, shortId, type IdentityIndex } from './format';
import styles from './settings.module.css';

/**
 * Admin-user management: who can sign in, and the one write this table makes.
 *
 * Read on the server (`listAdmins`), written through the existing
 * `toggleAdminAction`. The form contract is unchanged on purpose: each row still
 * submits hidden `user_id` **and** hidden `is_active` as the string `"true"` /
 * `"false"`, because `toggleAdminSchema` parses that field with
 * `checkboxSchema` — `"false"` is a real value there, not an absent checkbox.
 *
 * Pending is per row, not per table: each row owns its own `useActionForm`, so
 * deactivating one admin leaves every other row's button live. The previous
 * version shared one action state across the table, so one click disabled all of
 * them until the whole page revalidated.
 *
 * Deactivation asks first (it takes access away); reactivation is immediate,
 * because it only gives access back. A refused write — the action refuses
 * self-deactivation — lands inline under the row's own button as well as in a
 * toast, since a toast is gone in four seconds and this is a rule, not a hiccup.
 */
export default function AdminUsersPanel({
  admins,
  identityIndex,
  currentAdminId,
}: {
  admins: AdminUser[];
  /** `user_id` → email/name. Empty when the auth lookup failed; uuids stand in. */
  identityIndex: IdentityIndex;
  /** The signed-in admin, so their own row says so. Null when unreadable. */
  currentAdminId: string | null;
}) {
  const activeCount = admins.filter((admin) => admin.is_active === true).length;

  const columns = useMemo<DataTableColumn<AdminUser>[]>(
    () => [
      {
        key: 'admin',
        header: 'Admin',
        render: (row) => {
          const identity = indexIdentity(identityIndex, row.user_id);
          const name = identity?.name?.trim() || null;
          const email = identity?.email?.trim() || null;
          const isSelf =
            currentAdminId !== null && row.user_id.toLowerCase() === currentAdminId.toLowerCase();
          const label = name || email || shortId(row.user_id);
          const sub = name && email ? email : email ? shortId(row.user_id) : null;

          return (
            <div className={styles.identity}>
              <div className="row">
                {name || email ? (
                  <span className="cell-title truncate" title={email ?? row.user_id}>
                    {label}
                  </span>
                ) : (
                  // The service-client lookup missed this id (deleted account, or
                  // the call failed): show the uuid rather than an empty cell.
                  <span className="cell-title mono truncate" title={row.user_id}>
                    {label}
                  </span>
                )}
                {isSelf && <span className="chip">You</span>}
              </div>
              <div
                className={clsx('cell-sub', !name && 'mono', 'truncate')}
                title={row.user_id}
              >
                {sub ?? 'Not in auth.users'}
              </div>
            </div>
          );
        },
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => <span className="chip mono">{row.role}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          // Tone is explicit: `toneForStatus('deactivated')` would fall to
          // neutral anyway, but "deactivated" is a state, not an error, and it
          // must not be able to drift into rose through the status map.
          <StatusBadge
            value={row.is_active ? 'active' : 'deactivated'}
            label={row.is_active ? 'Active' : 'Deactivated'}
            tone={row.is_active ? 'success' : 'neutral'}
            dot
          />
        ),
      },
      {
        key: 'added',
        header: 'Added',
        hideOnMobile: true,
        render: (row) => <span className="num">{formatDate(row.created_at)}</span>,
      },
      {
        key: 'access',
        header: 'Access',
        render: (row) => {
          const identity = indexIdentity(identityIndex, row.user_id);
          const label =
            identity?.name?.trim() || identity?.email?.trim() || shortId(row.user_id);
          return <AdminAccessToggle admin={row} label={label} />;
        },
      },
    ],
    [identityIndex, currentAdminId],
  );

  return (
    <>
      <div className="card-header">
        <div>
          <h2 className="section-title">Administrators</h2>
          <p className="helper">
            {activeCount} of {admins.length} can sign in to this dashboard. Deactivate instead of
            deleting — the audit trail keeps pointing at the account, and reactivation is one click.
          </p>
        </div>
      </div>

      <DataTable
        caption="Admin users"
        columns={columns}
        rows={admins}
        rowKey={(row) => row.user_id}
        leading={(row) => {
          const identity = indexIdentity(identityIndex, row.user_id);
          return (
            <Avatar
              size="sm"
              name={identity?.name ?? undefined}
              email={identity?.email ?? shortId(row.user_id)}
            />
          );
        }}
        emptyTitle="No admin accounts"
        emptyHint="Add one below, using its Supabase auth.users id."
        emptyIcon={<Users size={22} aria-hidden />}
      />
    </>
  );
}

/**
 * One row's access control. Self-contained so its pending state cannot leak into
 * the other rows.
 */
function AdminAccessToggle({ admin, label }: { admin: AdminUser; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Any resolved write closes the dialog: the toast that `useActionForm` fires
  // carries the outcome, so a modal left open would only cover it.
  const closeOnResult = useCallback(() => setConfirming(false), []);
  const toggle = useActionForm(toggleAdminAction, { onResult: closeOnResult });

  const isActive = Boolean(admin.is_active);
  const error = toggle.state.status === 'error' ? toggle.state.formError : undefined;

  return (
    <form ref={formRef} action={toggle.formAction} className={styles.rowForm}>
      {/* Field names and value encoding are the action's contract — see the
          module doc. `is_active` is the row's *current* state, and the action
          flips it. */}
      <input type="hidden" name="user_id" value={admin.user_id} />
      <input type="hidden" name="is_active" value={String(isActive)} />

      <div className="row">
        {isActive ? (
          <button
            type="button"
            className="button small danger"
            onClick={() => setConfirming(true)}
            disabled={toggle.pending}
            aria-busy={toggle.pending}
            aria-label={`Deactivate ${label}`}
          >
            {toggle.pending ? 'Deactivating…' : 'Deactivate'}
          </button>
        ) : (
          <button
            type="submit"
            className="button small"
            disabled={toggle.pending}
            aria-busy={toggle.pending}
            aria-label={`Reactivate ${label}`}
          >
            {toggle.pending ? 'Reactivating…' : 'Reactivate'}
          </button>
        )}
      </div>

      {error && (
        <span className={styles.rowError} role="alert">
          {error}
        </span>
      )}

      <ConfirmModal
        open={confirming}
        tone="danger"
        title="Deactivate this admin?"
        body={
          <>
            <strong>{label}</strong> will not be able to sign in, and every admin route will bounce
            them. Their account and their audit history stay untouched, and you can reactivate them
            here at any time.
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Keep active"
        pending={toggle.pending}
        onClose={closeOnResult}
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
