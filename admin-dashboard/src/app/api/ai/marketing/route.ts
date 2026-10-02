export const runtime = 'nodejs';

import { generateText } from '@/lib/ai/agnes';
import { assertAiAllowed } from '@/lib/ai/guard';
import { requireAdmin } from '@/lib/utils/admin';
import { UNTRUSTED_DATA_GUARD, clampText, failJson, okJson, xmlBlock } from '@/lib/utils/prompt';
import { aiMarketingSchema, firstIssue } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    const parsed = aiMarketingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return failJson('BAD_REQUEST', firstIssue(parsed.error, 'brief is required', 'brief'), 400);
    }
    const safeBrief = clampText(parsed.data.brief);
    const prompt = `Create a concise marketing ops plan for YORD India. Include SEO opportunities, campaign ideas, and suggested tags. Use bullet points.
${UNTRUSTED_DATA_GUARD}
${xmlBlock('brief', safeBrief)}`;

    const output = await generateText(prompt);
    if (!output) {
      return failJson('UPSTREAM_EMPTY', 'Model returned an empty plan', 502);
    }
    const { data: job, error: jobError } = await service
      .from('ai_jobs')
      .insert({ type: 'marketing', status: 'complete', input_ref: safeBrief.slice(0, 500) })
      .select('id')
      .single();
    if (jobError) {
      console.error('ai_jobs insert failed', jobError);
      return okJson({ output }, { output });
    }
    const { error: suggestionError } = await service.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'marketing',
      entity_id: safeBrief.slice(0, 120),
      payload_json: { output } as never,
    });
    if (suggestionError) {
      console.error('ai_suggestions insert failed', suggestionError);
    }
    return okJson({ output }, { output });
  } catch (error: unknown) {
    console.error('Marketing generation failed', error);
    return failJson('INTERNAL', 'Marketing generation failed', 500);
  }
}
