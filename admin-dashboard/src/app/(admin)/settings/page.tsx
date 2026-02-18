import { createServerClient } from '@/lib/supabase/server';

async function addAdmin(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const userId = String(formData.get('user_id') || '').trim();
  if (!userId) return;
  await supabase.from('admin_users').insert({ user_id: userId, role: 'admin', is_active: true });
}

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const { data: audit } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(10);
  const { data: admins } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Admin Users</div>
            <div className="helper">Phase 1 supports Admin role only.</div>
          </div>
        </div>
        <form action={addAdmin} className="form-grid">
          <div>
            <label className="helper">Supabase User UUID</label>
            <input className="input" name="user_id" placeholder="auth.users id" />
          </div>
          <button className="button" type="submit">Add Admin</button>
        </form>
        <ul className="helper" style={{ marginTop: 12 }}>
          {(admins || []).map((admin) => (
            <li key={admin.user_id}>{admin.user_id} · {admin.role}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Audit Log</div>
            <div className="helper">Recent admin actions.</div>
          </div>
        </div>
        <ul className="helper" style={{ marginTop: 12 }}>
          {(audit || []).map((entry) => (
            <li key={entry.id}>{entry.action} · {entry.entity} #{entry.entity_id}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
