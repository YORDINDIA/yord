import type { Database } from '@yord/db-types';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Read-only in the admin app: auth, and nothing else.
 * Every mutation goes through a server action or an authenticated API route.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
