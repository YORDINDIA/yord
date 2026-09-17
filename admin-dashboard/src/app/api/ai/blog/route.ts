export const runtime = 'nodejs';

import { openai, textModel } from '@/lib/ai/openai';
import { getOutputText } from '@/lib/ai/parse';
import { assertAiAllowed } from '@/lib/ai/guard';
import { requireAdmin } from '@/lib/utils/admin';
import { UNTRUSTED_DATA_GUARD, clampText, failJson, okJson, xmlBlock } from '@/lib/utils/prompt';

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

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    const { topic, keywords } = await req.json();
    if (!topic || typeof topic !== 'string') {
      return failJson('BAD_REQUEST', 'topic is required', 400);
    }
    const prompt = `Create a blog draft for YORD India. Output JSON only with keys: summary_html, body_html, citations (array).
${UNTRUSTED_DATA_GUARD}
${xmlBlock('topic', clampText(topic))}
${xmlBlock('keywords', clampText(keywords))}`;

    const response = await openai.responses.create({
      model: textModel,
      input: prompt,
    });

    let output: unknown;
    try {
      output = extractJson(getOutputText(response) || '');
    } catch {
      return failJson('UPSTREAM_INVALID', 'Model returned invalid JSON', 502);
    }
    if (!output || typeof output !== 'object' || typeof (output as { body_html?: unknown }).body_html !== 'string') {
      return failJson('UPSTREAM_INVALID', 'Model returned an invalid draft', 502);
    }

    const safeInputRef = clampText(topic, 500);
    const { data: job, error: jobError } = await service
      .from('ai_jobs')
      .insert({ type: 'blog', status: 'complete', input_ref: safeInputRef })
      .select('id')
      .single();
    if (jobError) {
      console.error('ai_jobs insert failed', jobError);
      return okJson(output as Record<string, unknown>);
    }
    const { error: suggestionError } = await service.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'articles',
      entity_id: safeInputRef,
      payload_json: output as never,
    });
    if (suggestionError) {
      console.error('ai_suggestions insert failed', suggestionError);
    }
    return okJson(output as Record<string, unknown>);
  } catch (error: unknown) {
    console.error('Blog generation failed', error);
    return failJson('INTERNAL', 'Blog generation failed', 500);
  }
}
