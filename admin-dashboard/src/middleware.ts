import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Every page in this app except /login and /access-denied is an admin page
// (all live under the (admin) route group); keep this list in sync with
// src/app/(admin)/*.
const ADMIN_PAGE_PREFIXES = [
  '/ai',
  '/analytics',
  '/articles',
  '/blogs',
  '/collections',
  '/customers',
  '/dashboard',
  '/discounts',
  '/inventory',
  '/media',
  '/orders',
  '/products',
  '/settings',
];

function isAdminPage(pathname: string) {
  if (pathname === '/') return true;
  if (pathname === '/access-denied') return false;
  return ADMIN_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const isLogin = pathname.startsWith('/login');
  const isApi = pathname.startsWith('/api');

  if (!user && !isLogin) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLogin) {
    // Bounce authenticated users off the login page. Non-admins go to
    // /access-denied instead of /dashboard: sending them to /dashboard would
    // redirect them straight back here (login -> dashboard -> denied loop).
    const { data: loginAdmin } = await supabase
      .from('admin_users')
      .select('is_active')
      .eq('user_id', user.id)
      .single();
    if (!loginAdmin || (loginAdmin as { is_active: boolean | null }).is_active !== true) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Every page in this app except /login and /access-denied is an admin page.
  // Enforce the admin gate on ALL methods, not just writes: page Server
  // Components execute their queries before the layout renders, so a
  // writes-only check leaks data to authenticated non-admins.
  // Uses the anon SSR client (same self-read as (admin)/layout.tsx), never the
  // service-role key: service keys must stay in Node-only code (requireAdmin).
  // /api/* writes are covered per-route by requireAdmin().
  if (user && !isLogin && !isApi && isAdminPage(pathname)) {
    const { data: admin } = await supabase
      .from('admin_users')
      .select('is_active')
      .eq('user_id', user.id)
      .single();
    if (!admin || (admin as { is_active: boolean | null }).is_active !== true) {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/access-denied',
    '/api/:path*',
    '/ai/:path*',
    '/analytics/:path*',
    '/articles/:path*',
    '/blogs/:path*',
    '/collections/:path*',
    '/customers/:path*',
    '/dashboard/:path*',
    '/discounts/:path*',
    '/inventory/:path*',
    '/media/:path*',
    '/orders/:path*',
    '/products/:path*',
    '/settings/:path*',
  ],
};
