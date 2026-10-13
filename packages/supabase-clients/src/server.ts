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
 * bundled into a `'use client'` component, so `SUPABASE_SECRET_KEY`
 * cannot leak to the browser through these factories.
 */

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return url;
}

function supabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return key;
}

function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SECRET_KEY');
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
  return createServerSupabase<Database>(supabaseUrl(), supabasePublishableKey(), await nextCookieAdapter());
}

/** Secret-key client for admin operations. Server-side only. */
export function createServiceClient<Database>() {
  return createServiceSupabase<Database>(supabaseUrl(), supabaseSecretKey());
}

/** Publishable-key client for static generation (no cookies, no session). */
export function createStaticClient<Database>() {
  return createStaticSupabase<Database>(supabaseUrl(), supabasePublishableKey());
}
