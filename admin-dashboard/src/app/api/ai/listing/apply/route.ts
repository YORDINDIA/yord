export const runtime = 'nodejs';

import { logAudit } from '@/lib/utils/audit';
import { requireAdmin } from '@/lib/utils/admin';
import { clampText, failJson, okJson } from '@/lib/utils/prompt';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { user, service } = auth;

    const { productId, suggestion } = await req.json();
    if (!productId || typeof suggestion?.title !== 'string' || typeof suggestion?.body_html !== 'string') {
      return failJson('BAD_REQUEST', 'productId and suggestion title/body_html are required', 400);
    }

    const { data: before } = await service.from('products').select('*').eq('id', productId).single();
    if (!before) {
      return failJson('NOT_FOUND', 'Product not found', 404);
    }

    const { error } = await service
      .from('products')
      .update({
        title: suggestion.title.slice(0, 255),
        body_html: suggestion.body_html,
        tags: typeof suggestion.tags === 'string' ? clampText(suggestion.tags) : before.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
    if (error) {
      console.error('Product update failed', error);
      return failJson('INTERNAL', 'Failed to apply suggestion', 500);
    }

    await logAudit({
      actorId: user.id,
      action: 'ai_apply',
      entity: 'products',
      entityId: String(productId),
      before,
      after: suggestion,
    });

    return okJson({ success: true }, { success: true });
  } catch (error: unknown) {
    console.error('Listing apply failed', error);
    return failJson('INTERNAL', 'Failed to apply suggestion', 500);
  }
}
