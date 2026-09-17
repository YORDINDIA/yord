import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// NOTE: `import 'server-only'` is intentionally absent: the `server-only`
// package is not installed and adding dependencies is out of scope. The
// module-scope guard below fails closed instead: if this module is ever
// bundled into a Client Component, the build/runtime throws loudly rather
// than leaking the service-role key. Verified 2026-09-17: no file with
// `'use client'` imports this module (grep `createServiceClient`).
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/server must only be imported on the server.');
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - cookies are read-only
          }
        },
      },
    }
  );
}

// Service role client for admin operations (server-side only)
export function createServiceClient() {
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
