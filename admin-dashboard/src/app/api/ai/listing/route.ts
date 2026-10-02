export const runtime = 'nodejs';

import { generateText } from '@/lib/ai/agnes';
import { extractJson } from '@/lib/ai/parse';
import { assertAiAllowed } from '@/lib/ai/guard';
import { requireAdmin } from '@/lib/utils/admin';
import { UNTRUSTED_DATA_GUARD, failJson, okJson, toPlainText, xmlBlock } from '@/lib/utils/prompt';
import { aiListingRequestSchema, firstIssue } from '@/lib/validation';
import { getCoverImage } from '@/lib/data/products';

/**
 * Cover image for the AI studio.
 *
 * The studio used to read `product_images` from the browser with the publishable
 * key. This GET runs the same read server-side, so the key never touches a
 * product-images read and the lookup is not a second code path in the client.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const raw = new URL(req.url).searchParams.get('productId');
  const productId = Number(raw);
  if (!Number.isInteger(productId) || productId <= 0) {
    return failJson('BAD_REQUEST', 'productId is required', 400);
  }

  const cover = await getCoverImage(productId);
  return okJson(
    { imageId: cover?.id ?? null, imageUrl: cover?.url ?? null },
    { imageId: cover?.id ?? null, imageUrl: cover?.url ?? null },
  );
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    const parsed = aiListingRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return failJson(
        'BAD_REQUEST',
        firstIssue(parsed.error, 'productId is required', 'productId'),
        400,
      );
    }
    const { productId } = parsed.data;

    const { data: product } = await service
      .from('products')
      .select('id, title, body_html, tags, vendor, product_type')
      .eq('id', productId)
      .maybeSingle();

    if (!product) {
      return failJson('NOT_FOUND', 'Product not found', 404);
    }

    // DB-sourced fields are untrusted: strip HTML, truncate to 4k chars each,
    // and wrap in XML delimiters so the model treats them as data, not instructions.
    const prompt = `Improve the following product listing for YORD India. Output JSON only with keys: title, body_html, tags, collections (array), notes.
${UNTRUSTED_DATA_GUARD}
${xmlBlock('title', toPlainText(product.title))}
${xmlBlock('vendor', toPlainText(product.vendor))}
${xmlBlock('type', toPlainText(product.product_type))}
${xmlBlock('tags', toPlainText(product.tags))}
${xmlBlock('description', toPlainText(product.body_html))}
`;

    let suggestion: unknown;
    try {
      suggestion = extractJson(await generateText(prompt));
    } catch {
      return failJson('UPSTREAM_INVALID', 'Model returned invalid JSON', 502);
    }

    const { data: job, error: jobError } = await service
      .from('ai_jobs')
      .insert({ type: 'listing', status: 'complete', input_ref: String(productId) })
      .select('id')
      .single();
    if (jobError) {
      console.error('ai_jobs insert failed', jobError);
      return okJson({ suggestion }, { suggestion });
    }
    const { error: suggestionError } = await service.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'products',
      entity_id: String(productId),
      payload_json: suggestion as never,
    });
    if (suggestionError) {
      console.error('ai_suggestions insert failed', suggestionError);
    }

    return okJson({ suggestion }, { suggestion });
  } catch (error: unknown) {
    console.error('Listing generation failed', error);
    return failJson('INTERNAL', 'Listing generation failed', 500);
  }
}
