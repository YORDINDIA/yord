import 'server-only';

import { cookies } from 'next/headers';
import {
  createServerSupabase,
  createServiceSupabase,
  createStaticSupabase,
  type CookieMethods,
} from './index';

/**
 * Env-bound server entry. Import from `@yord/supabase-clients/server`.
 *
 * The `import 'server-only'` above fails the build if this module is ever
 * bundled into a `'use client'` component, so `SUPABASE_SERVICE_ROLE_KEY`
 * cannot leak to the browser through these factories.
 */

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return url;
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return key;
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return key;
}

async function nextCookieAdapter(): Promise<CookieMethods> {
  const cookieStore = await cookies();
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      } catch {
        // Server Component — cookies are read-only.
      }
    },
  };
}

/** Cookie-aware SSR client, typed with the caller's `Database`. */
export async function createServerClient<Database>() {
  return createServerSupabase<Database>(supabaseUrl(), supabaseAnonKey(), await nextCookieAdapter());
}

/** Service-role client for admin operations. Server-side only. */
export function createServiceClient<Database>() {
  return createServiceSupabase<Database>(supabaseUrl(), serviceRoleKey());
}

/** Anonymous client for static generation (no cookies, no session). */
export function createStaticClient<Database>() {
  return createStaticSupabase<Database>(supabaseUrl(), supabaseAnonKey());
}
