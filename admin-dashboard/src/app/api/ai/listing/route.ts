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
    const { productId } = await req.json();
    const supabase = createServiceClient();
    const { data: product } = await supabase
      .from('products')
      .select('id, title, body_html, tags, vendor, product_type, product_images(supabase_url, src)')
      .eq('id', productId)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const prompt = `Improve the following product listing for YORD India. Output JSON only with keys: title, body_html, tags, collections (array), notes.

Title: ${product.title}
Vendor: ${product.vendor}
Type: ${product.product_type}
Tags: ${product.tags}
Description: ${product.body_html}
`;

    const response = await openai.responses.create({
      model: textModel,
      input: prompt,
    });

    const suggestion = extractJson(getOutputText(response) || '');

    const { data: job } = await supabase
      .from('ai_jobs')
      .insert({ type: 'listing', status: 'complete', input_ref: String(productId) })
      .select('id')
      .single();
    await supabase.from('ai_suggestions').insert({
      job_id: job?.id || null,
      entity_type: 'products',
      entity_id: String(productId),
      payload_json: suggestion,
    });

    return NextResponse.json({ suggestion });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
