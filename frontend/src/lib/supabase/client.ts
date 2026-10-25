import type { Database } from '@yord/db-types';
import { createBrowserSupabase } from '@yord/supabase-clients';

/**
 * Placeholder endpoint used only when Supabase env is absent (e.g. a
 * backend-less `npm run build` prerendering a page that constructs the
 * browser client during SSR). Effects never run at build time, so the client
 * is never used for real requests; at runtime the real env is always present
 * (the hosts inject it), and a missing key warns loudly here.
 */
const PLACEHOLDER_URL = 'http://localhost:54321';
const PLACEHOLDER_KEY = 'build-without-backend';

/**
 * The app's browser client. The `@supabase/ssr` construction itself lives in
 * `@yord/supabase-clients` (`createBrowserSupabase`) so this file stays the
 * thin, env-resolving wrapper the package README describes — the env fallback
 * and the placeholder warning above are the only app-specific parts.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    console.warn(
      '[supabase] createClient: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
        'not set — using a placeholder endpoint.',
    );
    return createBrowserSupabase<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }
  return createBrowserSupabase<Database>(url, publishableKey);
}

// Singleton instance for client-side usage
let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
