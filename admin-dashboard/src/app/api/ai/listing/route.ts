export const runtime = 'nodejs';

import { openai, textModel } from '@/lib/ai/openai';
import { getOutputText } from '@/lib/ai/parse';
import { requireAdmin } from '@/lib/utils/admin';
import { UNTRUSTED_DATA_GUARD, failJson, okJson, toPlainText, xmlBlock } from '@/lib/utils/prompt';

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Unable to parse JSON');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const { productId } = await req.json();
    if (!productId) {
      return failJson('BAD_REQUEST', 'productId is required', 400);
    }
    const { data: product } = await service
      .from('products')
      .select('id, title, body_html, tags, vendor, product_type, product_images(supabase_url, src)')
      .eq('id', productId)
      .single();

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

    const response = await openai.responses.create({
      model: textModel,
      input: prompt,
    });

    let suggestion: unknown;
    try {
      suggestion = extractJson(getOutputText(response) || '');
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
