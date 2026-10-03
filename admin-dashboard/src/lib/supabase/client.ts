import type { Database } from '@yord/db-types';
import { createBrowserSupabase } from '@yord/supabase-clients';

/**
 * Browser client. Read-only in the admin app: auth, and nothing else.
 * Every mutation goes through a server action or an authenticated API route.
 */
export function createClient() {
  // The package reads no env (so a key cannot leak into a bundle); the
  // `NEXT_PUBLIC_` vars stay literal here so Next can inline them.
  return createBrowserSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}
