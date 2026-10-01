import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_ROUTE_PREFIXES, PUBLIC_ROUTE_PREFIXES, isOneOf } from '@/lib/constants';

/**
 * Admin gate.
 *
 * `ADMIN_ROUTE_PREFIXES` in `lib/constants.ts` is the list of gated segments,
 * and `isAdminRoute` reads it at request time. The `matcher` below is a separate
 * list because Next statically parses it: spreading the constant fails the build
 * ("can't recognize the exported `config` field"). Previously the two lists
 * each named the same routes with no check that they agreed, so adding a page
 * to one and not the other left it ungated. `src/lib/__tests__/routes.test.ts`
 * asserts they match the real `src/app/(admin)/*` tree.
 */

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`),
  );
}

function isAdminRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  const segment = pathname.split('/').filter(Boolean)[0];
  return isOneOf(ADMIN_ROUTE_PREFIXES, segment);
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith('/api');

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (isPublicRoute(pathname)) return response;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isApi) {
    // /api routes authorize per-handler with requireAdmin(); middleware only
    // guarantees there is a session, so an unauthenticated fetch gets a 401
    // with the right shape instead of a redirect.
    return response;
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('is_active')
    .eq('user_id', user.id)
    .single();
  const isActiveAdmin =
    Boolean(admin) && (admin as { is_active: boolean | null }).is_active === true;

  if (isPublicRoute(pathname)) {
    // Bounce authenticated admins off /login and /access-denied to the
    // dashboard. Non-admin sessions may RENDER both pages: redirecting them to
    // /access-denied trapped them — the only link on /access-denied goes to
    // /login, which bounced straight back, so they could neither sign out nor
    // switch accounts. Rendering /login lets them sign in as someone else.
    if (isActiveAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  if (isAdminRoute(pathname) && !isActiveAdmin) {
    return NextResponse.redirect(new URL('/access-denied', request.url));
  }

  return response;
}

/**
 * Route coverage.
 *
 * Next statically parses this array at build time, so it cannot be spread from
 * `ADMIN_ROUTE_PREFIXES` — a `.map()` here fails the build with "can't
 * recognize the exported `config` field". The two lists are therefore spelled
 * out, and `src/lib/__tests__/routes.test.ts` asserts they agree: it walks the
 * real `src/app/(admin)/*` tree and fails if a page exists here but not in
 * `ADMIN_ROUTE_PREFIXES` (or the reverse), which is what the two lists drifting
 * apart actually looked like.
 */
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
