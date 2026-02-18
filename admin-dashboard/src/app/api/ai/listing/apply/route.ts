export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/utils/audit';

export async function POST(req: Request) {
  try {
    const { productId, suggestion } = await req.json();
    const supabase = await createServerClient();
    const service = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: before } = await service.from('products').select('*').eq('id', productId).single();
    await service.from('products').update({
      title: suggestion.title,
      body_html: suggestion.body_html,
      tags: suggestion.tags,
      updated_at: new Date().toISOString(),
    }).eq('id', productId);

    if (user) {
      await logAudit({
        actorId: user.id,
        action: 'ai_apply',
        entity: 'products',
        entityId: productId,
        before,
        after: suggestion,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
