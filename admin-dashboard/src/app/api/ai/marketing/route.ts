export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openai, textModel } from '@/lib/ai/openai';
import { getOutputText } from '@/lib/ai/parse';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { brief } = await req.json();
    const prompt = `Create a concise marketing ops plan for YORD India. Include SEO opportunities, campaign ideas, and suggested tags. Use bullet points.
Brief: ${brief}`;

    const response = await openai.responses.create({
      model: textModel,
      input: prompt,
    });

    const output = getOutputText(response) || '';
    const supabase = createServiceClient();
    const { data: job } = await supabase
      .from('ai_jobs')
      .insert({ type: 'marketing', status: 'complete', input_ref: brief || 'marketing' })
      .select('id')
      .single();
    await supabase.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'marketing',
      entity_id: brief || 'brief',
      payload_json: { output },
    });
    return NextResponse.json({ output });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
