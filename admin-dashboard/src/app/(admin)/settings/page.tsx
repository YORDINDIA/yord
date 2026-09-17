import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils/format';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function addAdmin(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // admin_users is default-deny under RLS (sql/003_admin_rls.sql), so
  // admin-only reads/writes go through the service-role client.
  const service = createServiceClient();
  const { data: actor } = await service.from('admin_users').select('is_active').eq('user_id', user.id).single();
  if (!actor?.is_active) return;
  const userId = String(formData.get('user_id') || '').trim();
  if (!UUID_RE.test(userId)) return;
  const { error } = await service.from('admin_users').insert({ user_id: userId, role: 'admin', is_active: true });
  if (error) return;
  revalidatePath('/settings');
}

async function toggleAdmin(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const service = createServiceClient();
  const { data: actor } = await service.from('admin_users').select('is_active').eq('user_id', user.id).single();
  if (!actor?.is_active) return;
  const userId = String(formData.get('user_id') || '').trim();
  const active = formData.get('is_active') === 'true';
  if (!UUID_RE.test(userId) || userId === user.id) return;
  await service.from('admin_users').update({ is_active: !active }).eq('user_id', userId);
  revalidatePath('/settings');
}

export default async function SettingsPage() {
  const service = createServiceClient();
  const { data: audit } = await service.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(20);
  const { data: admins } = await service.from('admin_users').select('*').order('created_at', { ascending: false });

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Admin Users</div>
            <div className="helper">Deactivate instead of delete. You cannot deactivate yourself.</div>
          </div>
        </div>
        <form action={addAdmin} className="form-grid">
          <div>
            <label className="helper">Supabase User UUID</label>
            <input className="input" name="user_id" placeholder="auth.users id" />
          </div>
          <button className="button" type="submit">Add Admin</button>
        </form>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(admins || []).map((admin: { user_id: string; role: string | null; is_active: boolean | null }) => (
                <tr key={admin.user_id}>
                  <td><span className="helper">{admin.user_id}</span></td>
                  <td>{admin.role}</td>
                  <td><StatusBadge value={admin.is_active ? 'yes' : 'no'} label={admin.is_active ? 'Active' : 'Inactive'} /></td>
                  <td>
                    <form action={toggleAdmin}>
                      <input type="hidden" name="user_id" value={admin.user_id} />
                      <input type="hidden" name="is_active" value={String(Boolean(admin.is_active))} />
                      <button className="button" type="submit">
                        {admin.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Audit Log</div>
            <div className="helper">Last 20 admin actions.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(audit || []).map((entry: { id: number; action: string | null; entity: string | null; entity_id: number | null; created_at: string | null }) => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td><span className="helper">{entry.entity} #{entry.entity_id}</span></td>
                  <td>{formatDate(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
