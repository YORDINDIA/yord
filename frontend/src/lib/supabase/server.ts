import type { Database } from '@yord/db-types';
import {
  createServerClient as createPkgServerClient,
  createServiceClient as createPkgServiceClient,
  createStaticClient as createPkgStaticClient,
} from '@yord/supabase-clients/server';

/**
 * Server-side Supabase clients, typed with the shared `Database`.
 * Factories live in `@yord/supabase-clients/server` (which starts with
 * `import 'server-only'`); this module only binds the `Database` generic so
 * existing `@/lib/supabase/server` import sites keep working.
 */

export async function createServerClient() {
  return createPkgServerClient<Database>();
}

// Service role client for admin operations (server-side only)
export function createServiceClient() {
  return createPkgServiceClient<Database>();
}

// Anonymous client for static generation (no cookies required)
export function createStaticClient() {
  return createPkgStaticClient<Database>();
}
