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
 * secret-key factory stays strict: a missing `SUPABASE_SECRET_KEY`
 * in an API route must 500 loudly, never silently degrade.
 */

const PLACEHOLDER_URL = 'http://localhost:54321';
const PLACEHOLDER_KEY = 'build-without-backend';

let warnedMissingEnv = false;

/**
 * The fallback is reached for two different reasons — the env really is unset
 * (a backend-less build), or the factory threw for another reason (the most
 * common: `cookies()` outside a request scope while Next collects page data at
 * build time). Reporting both as "env not set" sent readers after a phantom
 * misconfiguration: the build logs four of these on a machine where the env is
 * present and correct. Carry the cause.
 */
function warnFallback(factory: string, cause: unknown): void {
  if (warnedMissingEnv) return;
  warnedMissingEnv = true;
  const reason = cause instanceof Error ? cause.message : String(cause);
  console.warn(
    `[supabase] ${factory}: falling back to a placeholder endpoint (${reason}). ` +
      'If NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are unset this is ' +
      'expected and reads degrade to empty; otherwise the factory failed for the reason above.',
  );
}

export async function createServerClient() {
  try {
    return await createPkgServerClient<Database>();
  } catch (error) {
    warnFallback('createServerClient', error);
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

// Service-key client for admin operations (server-side only)
export function createServiceClient() {
  return createPkgServiceClient<Database>();
}

// Publishable-key client for static generation (no cookies required)
export function createStaticClient() {
  try {
    return createPkgStaticClient<Database>();
  } catch (error) {
    warnFallback('createStaticClient', error);
    return createStaticSupabase<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }
}
