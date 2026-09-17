import { NextResponse } from 'next/server';
import { createStaticClient } from '@/lib/supabase/server';
import { logDbError } from '@/lib/logger';

/**
 * Liveness + Supabase reachability probe.
 * Uses the anon client with a zero-row select so no data is read;
 * a reachable DB returns ok:true, otherwise 503.
 */
export async function GET() {
  try {
    const supabase = createStaticClient();
    const { error } = await supabase.from('products').select('id').limit(0);
    if (error) {
      logDbError('health', error);
      return NextResponse.json(
        { ok: false, supabase: 'unreachable' },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, supabase: 'reachable' });
  } catch (error) {
    logDbError('health', error);
    return NextResponse.json(
      { ok: false, supabase: 'unreachable' },
      { status: 503 }
    );
  }
}
