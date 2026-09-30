import type { Database } from '@yord/db-types';
import {
  createServerClient as createPkgServerClient,
  createServiceClient as createPkgServiceClient,
  createStaticClient as createPkgStaticClient,
} from '@yord/supabase-clients/server';
import {
  createServerSupabase,
  createStaticSupabase,
} from '@yord/supabase-clients';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase clients, typed with the shared `Database`.
 * Factories live in `@yord/supabase-clients/server` (which starts with
 * `import 'server-only'`); this module only binds the `Database` generic so
 * existing `@/lib/supabase/server` import sites keep working.
 *
 * Missing-env tolerance: when Supabase is unconfigured (e.g. a backend-less
 * `npm run build`), the cookie-aware and static factories return a client
 * pointed at a placeholder endpoint instead of throwing at creation. Reads
 * then fail through the normal `DatabaseError`/degrade paths — and
 * `queryOrThrow` short-circuits before any request is attempted — so
 * prerendered pages build with empty data instead of failing the build. The
 * service-role factory stays strict: a missing `SUPABASE_SERVICE_ROLE_KEY`
 * in an API route must 500 loudly, never silently degrade.
 */

const PLACEHOLDER_URL = 'http://localhost:54321';
const PLACEHOLDER_KEY = 'build-without-backend';

let warnedMissingEnv = false;

function warnMissingEnv(factory: string): void {
  if (!warnedMissingEnv) {
    warnedMissingEnv = true;
    console.warn(
      `[supabase] ${factory}: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ` +
        'not set — using a placeholder endpoint. Reads will degrade to empty.',
    );
  }
}

export async function createServerClient() {
  try {
    return await createPkgServerClient<Database>();
  } catch {
    warnMissingEnv('createServerClient');
    const cookieStore = await cookies();
    return createServerSupabase<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY, {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component — cookies are read-only.
        }
      },
    });
  }
}

// Service role client for admin operations (server-side only)
export function createServiceClient() {
  return createPkgServiceClient<Database>();
}

// Anonymous client for static generation (no cookies required)
export function createStaticClient() {
  try {
    return createPkgStaticClient<Database>();
  } catch {
    warnMissingEnv('createStaticClient');
    return createStaticSupabase<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }
}
