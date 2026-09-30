import 'server-only';

import type { Database } from '@yord/db-types';
import {
  createServerClient as createPkgServerClient,
  createServiceClient as createPkgServiceClient,
} from '@yord/supabase-clients/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Server-side clients only. `server-only` fails the build if bundled client-side. */
export type ServerClient = SupabaseClient<Database>;

/**
 * Session-scoped client (anon key + SSR cookies). The caller's own session and
 * RLS apply, which is what middleware.ts and (admin)/layout.tsx rely on to
 * read their own `admin_users` row.
 */
export async function createServerClient(): Promise<ServerClient> {
  return createPkgServerClient<Database>();
}

// Service role client for admin operations (server-side only)
export function createServiceClient(): ServerClient {
  return createPkgServiceClient<Database>();
}
