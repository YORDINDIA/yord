export const runtime = 'nodejs';

import { generateText } from '@/lib/ai/agnes';
import { extractJson } from '@/lib/ai/parse';
import { assertAiAllowed } from '@/lib/ai/guard';
import { requireAdmin } from '@/lib/utils/admin';
import { UNTRUSTED_DATA_GUARD, clampText, failJson, okJson, xmlBlock } from '@/lib/utils/prompt';
import { aiBlogDraftSchema, firstIssue } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    // The AI hub page promises every studio answers NOT_CONFIGURED when the key
    // is missing. Without this check the `generateText` throw landed in the
    // catches below and reported a model-quality error instead.
    if (!process.env.AGNES_AI_API_KEY) {
      return failJson('NOT_CONFIGURED', 'AI service not configured', 500);
    }

    // One schema, shared with the client form: the old check was a bare
    // `if (!topic || typeof topic !== 'string')`.
    const parsed = aiBlogDraftSchema.safeParse(await req.json());
    if (!parsed.success) {
      return failJson('BAD_REQUEST', firstIssue(parsed.error, 'topic is required', 'topic'), 400);
    }
    const { topic, keywords } = parsed.data;
    const prompt = `Create a blog draft for YORD India. Output JSON only with keys: summary_html, body_html, citations (array).
${UNTRUSTED_DATA_GUARD}
${xmlBlock('topic', clampText(topic))}
${xmlBlock('keywords', clampText(keywords))}`;

    // A failed Agnes request (network, auth, model error) and unreadable model
    // text are different failures: the first is an upstream outage, logged and
    // reported as a request failure; only the second is 'invalid JSON'.
    let raw: string;
    try {
      raw = await generateText(prompt);
    } catch (error: unknown) {
      console.error('Agnes blog request failed', error);
      return failJson('UPSTREAM_ERROR', 'Model request failed', 502);
    }

    let output: unknown;
    try {
      output = extractJson(raw);
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
