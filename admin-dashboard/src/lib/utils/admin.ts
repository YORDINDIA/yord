import 'server-only';

import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient, type ServerClient } from '@/lib/supabase/server';

export interface AdminSession {
  user: User;
  /** Session-scoped anon client (the admin's own RLS context). */
  supabase: ServerClient;
  /** Service client, for writes and default-deny admin tables. */
  service: ServerClient;
}

/**
 * Require an authenticated, active admin.
 *
 * Two shapes, deliberately:
 *  - `requireAdminApi()` returns `{ error: NextResponse }` for route handlers.
 *  - `requireAdminAction()` throws `ForbiddenError` for server actions, where
 *    returning a NextResponse would be a lie (it would resolve successfully and
 *    the form would render as if the write happened).
 *
 * Both read the caller's own `admin_users` row via the **service** client.
 * middleware.ts and (admin)/layout.tsx deliberately keep using the *anon* client
 * for that read, because sql/003_admin_rls.sql's `admin_users_self_read` policy
 * only grants an authenticated user their own row.
 */
async function authorize(): Promise<AdminSession | 'unauthorized' | 'forbidden'> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 'unauthorized';

  const service = createServiceClient();
  const { data: admin, error } = await service
    .from('admin_users')
    .select('user_id, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!admin?.is_active) return 'forbidden';

  return { user, supabase, service };
}

export async function requireAdminApi(): Promise<AdminSession | { error: NextResponse }> {
  const result = await authorize();
  if (result === 'unauthorized') {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (result === 'forbidden') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return result;
}

export async function requireAdminAction(): Promise<AdminSession> {
  const { ForbiddenError } = await import('@/lib/errors');
  const result = await authorize();
  if (result === 'unauthorized') {
    throw new ForbiddenError('Sign in to continue.');
  }
  if (result === 'forbidden') {
    throw new ForbiddenError();
  }
  return result;
}

/**
 * Backwards-compatible alias. Existing call sites in api/ routes keep working
 * while server actions migrate to `requireAdminAction()`.
 */
export const requireAdmin = requireAdminApi;
