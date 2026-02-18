import AdminShell from '@/components/layout/AdminShell';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('user_id, is_active')
    .eq('user_id', user.id)
    .single();

  if (!error && (!admin || admin.is_active === false)) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="card-header">
            <div>
              <div className="brand-sub">YORD INDIA</div>
              <div className="card-title">Access denied</div>
            </div>
          </div>
          <div className="helper">This account is not registered as an admin.</div>
        </div>
      </div>
    );
  }

  return <AdminShell title="YORD Admin">{children}</AdminShell>;
}
