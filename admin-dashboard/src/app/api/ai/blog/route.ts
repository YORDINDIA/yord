export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openai, textModel } from '@/lib/ai/openai';
import { getOutputText } from '@/lib/ai/parse';
import { createServiceClient } from '@/lib/supabase/server';

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
    const { topic, keywords } = await req.json();
    const prompt = `Create a blog draft for YORD India. Output JSON only with keys: summary_html, body_html, citations (array).
Topic: ${topic}
Keywords: ${keywords}`;

    const response = await openai.responses.create({
      model: textModel,
      input: prompt,
    });

    const output = extractJson(getOutputText(response) || '');
    const supabase = createServiceClient();
    const { data: job } = await supabase
      .from('ai_jobs')
      .insert({ type: 'blog', status: 'complete', input_ref: topic || 'blog' })
      .select('id')
      .single();
    await supabase.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'articles',
      entity_id: topic || 'draft',
      payload_json: output,
    });
    return NextResponse.json(output);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
