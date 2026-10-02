import { createBrowserClient, createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase client factories for the YORD monorepo.
 *
 * Both `frontend` and `admin-dashboard` import these instead of
 * re-implementing the same three clients. The generic `Database` is supplied
 * by the caller so this package takes no dependency on either app's schema
 * types.
 *
 * Key material is passed in as arguments — never read from `process.env` in
 * here — so the secret key cannot leak into a client bundle through
 * this module. The env-bound convenience entry lives in `./server`, which
 * starts with `import 'server-only'` and fails the build if ever pulled into
 * `'use client'` code.
 */

export interface CookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll: (cookiesToSet: { name: string; value: string; options?: object }[]) => void;
}

const noopCookies: CookieMethods = {
  getAll: () => [],
  setAll: () => {},
};

const noPersistentSession = {
  autoRefreshToken: false,
  persistSession: false,
} as const;

/** Cookie-aware SSR client (reads/writes auth cookies via the adapter). */
export function createServerSupabase<Database>(
  supabaseUrl: string,
  publishableKey: string,
  cookies: CookieMethods,
): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, publishableKey, { cookies });
}

/** Secret-key client for admin/mutation work. Server-side only. */
export function createServiceSupabase<Database>(
  supabaseUrl: string,
  secretKey: string,
): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, secretKey, {
    cookies: noopCookies,
    auth: { ...noPersistentSession },
  });
}

/** Publishable-key client for static generation / public reads. No cookies. */
export function createStaticSupabase<Database>(
  supabaseUrl: string,
  publishableKey: string,
): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: noopCookies,
    auth: { ...noPersistentSession },
  });
}

/** Browser client. The single place `@supabase/ssr` browser code is constructed. */
export function createBrowserSupabase<Database>(
  supabaseUrl: string,
  publishableKey: string,
): SupabaseClient<Database> {
  return createBrowserClient<Database>(supabaseUrl, publishableKey);
}
