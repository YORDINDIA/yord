'use client';

import { useActionForm, ActionField, FormError } from '@/components/forms/ActionForm';
import { addAdminAction, toggleAdminAction } from '@/server/actions/settings';
import StatusBadge from '@/components/ui/StatusBadge';
import type { AdminUser } from '@yord/db-types';

/**
 * Admin-user management.
 *
 * Both inline actions here re-implemented the admin check (`auth.getUser()`, then
 * an `admin_users` lookup) and returned silently for every failure: an invalid
 * UUID, a duplicate, a write error, and "you cannot deactivate yourself" all
 * produced the same inert re-render. `addAdminAction` / `toggleAdminAction`
 * centralize that check and report each case.
 */
export default function AdminUsersPanel({ admins }: { admins: AdminUser[] }) {
  const add = useActionForm(addAdminAction);
  const toggle = useActionForm(toggleAdminAction);

  return (
    <>
      <form action={add.formAction} className="form-grid" noValidate>
        <FormError state={add.state} />

        <ActionField name="user_id" label="Supabase User UUID" state={add.state}>
          <input
            className="input"
            id="user_id"
            name="user_id"
            placeholder="auth.users id"
            aria-invalid={Boolean(add.errorFor('user_id'))}
            aria-describedby={add.errorFor('user_id') ? 'user_id-error' : undefined}
          />
        </ActionField>

        <button className="button" type="submit" disabled={add.pending} aria-busy={add.pending}>
          {add.pending ? 'Adding…' : 'Add Admin'}
        </button>
      </form>

      {toggle.state.status === 'error' && toggle.state.formError && (
        <div
          className="form-alert form-alert-error"
          role="alert"
          style={{ marginTop: 12 }}
        >
          {toggle.state.formError}
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <caption className="sr-only">Admin users</caption>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={4} className="helper">
                  No admins configured.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.user_id}>
                  <th scope="row" className="helper">
                    {admin.user_id}
                  </th>
                  <td>{admin.role}</td>
                  <td>
                    <StatusBadge
                      value={admin.is_active ? 'yes' : 'no'}
                      label={admin.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td>
                    <form action={toggle.formAction}>
                      <input type="hidden" name="user_id" value={admin.user_id} />
                      <input
                        type="hidden"
                        name="is_active"
                        value={String(Boolean(admin.is_active))}
                      />
                      <button
                        className="button"
                        type="submit"
                        disabled={toggle.pending}
                        aria-busy={toggle.pending}
                      >
                        {admin.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
