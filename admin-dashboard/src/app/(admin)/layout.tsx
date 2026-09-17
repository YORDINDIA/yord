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

  // Defense in depth: middleware already redirects authenticated non-admins
  // to /access-denied, but page Server Components run their queries before
  // this layout renders. Fail closed here too so a middleware bypass can
  // never leak admin query results to an authenticated non-admin.
  if (error || !admin || !admin.is_active) {
    redirect('/access-denied');
  }

  return <AdminShell title="YORD Admin">{children}</AdminShell>;
}
