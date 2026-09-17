export const runtime = 'nodejs';

import { imageModel } from '@/lib/ai/openai';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/utils/admin';
import { isAllowedImageUrl } from '@/lib/utils/sanitize';
import { clampText, failJson, okJson } from '@/lib/utils/prompt';

const MAX_IMAGE_BYTES = 10_000_000;

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    if (!process.env.OPENAI_API_KEY) {
      return failJson('NOT_CONFIGURED', 'Image service not configured', 500);
    }

    const { imageUrl, prompt } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string' || !isAllowedImageUrl(imageUrl)) {
      return failJson('BAD_REQUEST', 'imageUrl must be an https Supabase storage URL', 400);
    }
    // Admin-typed prompt is still untrusted model input: truncate to 4k chars.
    const safePrompt = clampText(prompt) || 'Enhance the product image for premium ecommerce.';

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return failJson('BAD_REQUEST', 'Unable to fetch source image', 400);
    }
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return failJson('BAD_REQUEST', 'Source URL is not an image', 400);
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return failJson('BAD_REQUEST', 'Source image too large', 413);
    }
    const blob = new Blob([arrayBuffer], { type: contentType });

    const form = new FormData();
    form.append('model', imageModel);
    form.append('prompt', safePrompt);
    form.append('image', blob, 'reference.png');
    // `response_format` is DALL·E-only; gpt-image-1 always returns b64_json and
    // rejects the parameter.
    if (imageModel.startsWith('dall-e')) {
      form.append('response_format', 'b64_json');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: form,
    });

    if (!aiResponse.ok) {
      console.error('OpenAI image edit failed', aiResponse.status);
      return failJson('UPSTREAM_INVALID', 'Image generation failed', 502);
    }

    const result = await aiResponse.json();
    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      return failJson('UPSTREAM_EMPTY', 'Image generation failed', 500);
    }

    const buffer = Buffer.from(b64, 'base64');
    const supabase = service ?? createServiceClient();
    const path = `ai/${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('products')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (error) {
      return failJson('INTERNAL', 'Image upload failed', 500);
    }
    const { data: urlData } = supabase.storage.from('products').getPublicUrl(path);

    const { data: job, error: jobError } = await supabase
      .from('ai_jobs')
      .insert({ type: 'image', status: 'complete', input_ref: imageUrl })
      .select('id')
      .single();
    if (jobError) {
      console.error('ai_jobs insert failed', jobError);
      return okJson(
        { previewUrl: urlData.publicUrl, storagePath: path },
        { previewUrl: urlData.publicUrl, storagePath: path }
      );
    }

    const { error: assetError } = await supabase.from('ai_assets').insert({
      job_id: job?.id || null,
      storage_path: path,
      preview_url: urlData.publicUrl,
      metadata: { prompt: safePrompt || null },
    });
    if (assetError) {
      console.error('ai_assets insert failed', assetError);
    }

    return okJson(
      { previewUrl: urlData.publicUrl, storagePath: path },
      { previewUrl: urlData.publicUrl, storagePath: path }
    );
  } catch (error: unknown) {
    console.error('Image route failed', error);
    return failJson('INTERNAL', 'Image generation failed', 500);
  }
}
