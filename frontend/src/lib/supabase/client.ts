import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@yord/db-types';

/**
 * Placeholder endpoint used only when Supabase env is absent (e.g. a
 * backend-less `npm run build` prerendering a page that constructs the
 * browser client during SSR). Effects never run at build time, so the client
 * is never used for real requests; at runtime the real env is always present
 * (Netlify injects it), and a missing key warns loudly here.
 */
const PLACEHOLDER_URL = 'http://localhost:54321';
const PLACEHOLDER_KEY = 'build-without-backend';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    console.warn(
      '[supabase] createClient: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
        'not set — using a placeholder endpoint.',
    );
    return createBrowserClient<Database>(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }
  return createBrowserClient<Database>(url, publishableKey);
}

// Singleton instance for client-side usage
let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
