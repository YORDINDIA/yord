import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as NextResponse };
  }

  const service = createServiceClient();
  const { data: admin, error } = await service
    .from('admin_users')
    .select('user_id, is_active')
    .eq('user_id', user.id)
    .single();

  if (error || !admin || !admin.is_active) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) as NextResponse };
  }

  return { user, supabase, service };
}
