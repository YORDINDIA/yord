import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_ROUTE_PREFIXES, PUBLIC_ROUTE_PREFIXES } from '@/lib/constants';
import { config as middlewareConfig } from '@/middleware';

/**
 * The admin gate's route coverage.
 *
 * `ADMIN_ROUTE_PREFIXES` is read at request time by `isAdminRoute`, and
 * `middleware.ts` exports a `matcher` that Next parses statically. They are two
 * separate lists because a spread from the constant fails the build. Before this
 * test, nothing asserted they agreed: the original file had a comment admitting
 * the manual sync, and a page added to one list but not the other would be
 * silently ungated.
 */

const APP_DIR = join(process.cwd(), 'src', 'app');
const ADMIN_GROUP = join(APP_DIR, '(admin)');

/** Top-level route segments that exist as a real page under `src/app/(admin)`. */
function adminRouteSegments(): string[] {
  return readdirSync(ADMIN_GROUP)
    .filter((entry) => statSync(join(ADMIN_GROUP, entry)).isDirectory())
    // Route groups and layout-only entries are not navigable segments.
    .filter((entry) => !entry.startsWith('(') && !entry.startsWith('@') && !entry.startsWith('.'))
    .sort();
}

/** The `matcher`'s `/:path*` entries, as bare segments. */
function matcherSegments(): string[] {
  return middlewareConfig.matcher
    .map((entry) => /^\/([^/:]+)\/:path\*$/.exec(entry)?.[1])
    // `/api/:path*` is matched so unauthenticated fetches get a 401 rather than
    // a redirect, but `/api` is not an admin page segment.
    .filter((segment): segment is string => segment !== undefined && segment !== 'api')
    .sort();
}

describe('admin route coverage', () => {
  it('has a real page directory for every declared prefix', () => {
    const actual = adminRouteSegments();
    for (const prefix of ADMIN_ROUTE_PREFIXES) {
      expect(actual, `ADMIN_ROUTE_PREFIXES lists "${prefix}" but src/app/(admin)/${prefix} does not exist`)
        .toContain(prefix);
    }
  });

  it('has no admin page directory missing from the prefix list', () => {
    // The dangerous direction: a page that exists but is not gated.
    const actual = adminRouteSegments();
    const declared = [...ADMIN_ROUTE_PREFIXES];
    for (const segment of actual) {
      expect(declared, `src/app/(admin)/${segment} exists but is not in ADMIN_ROUTE_PREFIXES`)
        .toContain(segment);
    }
  });

  it('keeps the middleware matcher in step with the prefix list', () => {
    expect(matcherSegments()).toEqual([...ADMIN_ROUTE_PREFIXES].sort());
  });

  it('gates the public routes out of the admin matcher', () => {
    // `/login` and `/access-denied` must be matched (so middleware can bounce an
    // authenticated admin away) but must never be treated as admin routes.
    for (const prefix of PUBLIC_ROUTE_PREFIXES) {
      expect(middlewareConfig.matcher).toContain(`/${prefix}`);
      expect(ADMIN_ROUTE_PREFIXES as readonly string[]).not.toContain(prefix);
    }
  });

  it('matches the API surface and the root redirect', () => {
    expect(middlewareConfig.matcher).toContain('/');
    expect(middlewareConfig.matcher).toContain('/api/:path*');
  });
});
