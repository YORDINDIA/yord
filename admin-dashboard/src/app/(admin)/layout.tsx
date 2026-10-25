import AdminShell from '@/components/layout/AdminShell';
import { getNavBadges } from '@/lib/data/nav';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Every admin route requires a live session, so nothing under this layout may
 * be statically prerendered — stated here at the segment root rather than left
 * to the cookies() bail-out during render. The difference shows up in CI-class
 * builds (GitHub Actions, Cloudflare Workers *preview* builds) whose
 * environment carries no Supabase variables: a prerender *attempt* still
 * constructs the server client, which throws `Missing
 * NEXT_PUBLIC_SUPABASE_URL` before any cookie read can mark the route
 * dynamic, and the export fails. `force-dynamic` skips the attempt entirely,
 * matching the documented rule that admin routes are dynamic by design.
 * Production Workers builds (which do carry the variables) are unaffected.
 */
export const dynamic = 'force-dynamic';

/**
 * Sidebar counts, degraded on purpose.
 *
 * The data layer never reports a failed read as zero (`getNavBadges` throws),
 * and nothing else in the shell catches it: this is chrome, not page data, so a
 * badge query failing must not blank the whole admin. The page renders with
 * empty badges and the error is logged.
 */
async function navBadgesOrEmpty(): Promise<{ fulfillmentQueue: number; lowStock: number }> {
  try {
    return await getNavBadges();
  } catch (error) {
    console.error('Sidebar badges unavailable', error);
    return { fulfillmentQueue: 0, lowStock: 0 };
  }
}

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

  return (
    <AdminShell
      title="YORD Admin"
      email={user.email ?? null}
      badges={await navBadgesOrEmpty()}
    >
      {children}
    </AdminShell>
  );
}
