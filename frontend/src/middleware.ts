import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { conceptsEnabled } from '@/features/concepts/gate';

/**
 * Routes whose response depends on who is asking.
 *
 * Everything else — the catalog, artists, concerts, policy pages — renders the
 * same for every visitor, and `supabase.auth.getUser()` is a network round trip
 * plus a JWT parse on every matched request. On Workers Free (10 ms CPU per
 * invocation) that was a sizeable slice of the budget for a signed-in state
 * nothing on those pages reads. `/checkout` and `/track-order` stay on the list
 * because they do read it, and because the refresh they perform is what keeps
 * a shopper's session alive across the funnel.
 */
const AUTH_PATHS = ['/account', '/auth', '/checkout', '/track-order'];

/** Query params that turn a catalog URL into a facet of it. */
const FACET_PARAMS = ['artist', 'type', 'size', 'price', 'stock', 'sort', 'page'];

/** Catalog paths whose bare form is the canonical, indexable page. */
const CATALOG_PATHS = ['/products', '/collection/'];

const needsSession = (pathname: string) =>
  AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isCatalogPath = (pathname: string) =>
  CATALOG_PATHS.some((path) => pathname === path || pathname.startsWith(path));

/**
 * Facets carry no server-rendered copy any more — the catalog pages prerender
 * the unfiltered page 1 and the filters are applied client-side — so a crawl of
 * `?size=M&price=…` finds the same HTML under a different URL. Mark them
 * `noindex, follow` and let `/products`, `/collection/[handle]` and
 * `/artist/[handle]` hold the rankings.
 */
function withFacetRobots(request: NextRequest, response: NextResponse): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  if (isCatalogPath(pathname) && FACET_PARAMS.some((key) => searchParams.has(key))) {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Design concepts are dev-only unless NEXT_PUBLIC_SHOW_CONCEPTS=1. A layout
  // notFound() would stream a 200 under (main)/loading.tsx, so answer a real
  // 404 here by rewriting to a path that does not exist.
  if (!conceptsEnabled && pathname.startsWith('/concepts')) {
    return NextResponse.rewrite(new URL('/concepts-disabled', request.url));
  }

  // Anonymous, cached catalog and marketing pages: no session to refresh.
  if (!needsSession(pathname)) {
    return withFacetRobots(request, NextResponse.next({ request }));
  }

  // Protected routes - redirect to login if not authenticated
  const isProtectedPath = pathname === '/account' || pathname.startsWith('/account/');
  const loginRedirect = () => {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  };

  // Supabase unconfigured (no URL/publishable key): there is no session to
  // refresh, so skip the client instead of constructing one that would throw.
  // Public reads degrade via lib/result.ts as they do in RSC; protected paths
  // fail closed, since no user can be proven.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.warn('[middleware] Supabase env not set — skipping session refresh.');
    if (isProtectedPath) return loginRedirect();
    return withFacetRobots(request, NextResponse.next({ request }));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedPath && !user) return loginRedirect();

  // Redirect authenticated users away from auth pages
  const authPaths = ['/auth/login', '/auth/register'];
  const isAuthPath = authPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isAuthPath && user) {
    return NextResponse.redirect(new URL('/account', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
