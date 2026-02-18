export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { imageModel } from '@/lib/ai/openai';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });
    }

    const imageResponse = await fetch(imageUrl);
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: contentType });

    const form = new FormData();
    form.append('model', imageModel);
    form.append('prompt', prompt || 'Enhance the product image for premium ecommerce.');
    form.append('image', blob, 'reference.png');

    const aiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    const result = await aiResponse.json();
    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: 'No image returned', details: result }, { status: 500 });
    }

    const buffer = Buffer.from(b64, 'base64');
    const supabase = createServiceClient();
    const path = `ai/${Date.now()}.png`;
    const { error } = await supabase.storage.from('products').upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(path);


    const { data: job } = await supabase
      .from('ai_jobs')
      .insert({ type: 'image', status: 'complete', input_ref: imageUrl })
      .select('id')
      .single();

    await supabase.from('ai_assets').insert({
      job_id: job?.id || null,
      storage_path: path,
      preview_url: urlData.publicUrl,
      metadata: { prompt: prompt || null },
    });

    return NextResponse.json({ previewUrl: urlData.publicUrl, storagePath: path });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
