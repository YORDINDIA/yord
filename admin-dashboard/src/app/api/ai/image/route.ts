export const runtime = 'nodejs';

import { imageModel } from '@/lib/ai/openai';
import { assertAiAllowed } from '@/lib/ai/guard';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/utils/admin';
import { clampText, failJson, okJson } from '@/lib/utils/prompt';

const MAX_IMAGE_BYTES = 10_000_000;
const MAX_IMPORT_REDIRECTS = 5;

// Imports are limited to the Shopify CDN hosts the migration itself pulls
// media from. fetch() follows redirects, so the host check is re-applied to
// every hop — otherwise an approved URL could 302 the server-side fetch at an
// internal service (cloud metadata, localhost admin ports, RFC1918 targets).
const ALLOWED_IMPORT_HOSTS = [
  'cdn.shopify.com',
  'shopifycdn.com',
  'cdn.shopifycdn.net',
];

function isAllowedImportHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_IMPORT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

/** Reject URLs that are not approved public CDN images or smuggle credentials. */
function isBlockedImportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol !== 'https:' ||
      Boolean(url.username || url.password) ||
      !isAllowedImportHost(url.hostname)
    );
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    if (!process.env.OPENAI_API_KEY) {
      return failJson('NOT_CONFIGURED', 'Image service not configured', 500);
    }

    const { imageUrl, prompt } = await req.json();
    // Accept the cover URL as stored: migrated products carry the Shopify CDN
    // `src`, and rejecting those made image generation fail for every
    // product. The fetch below is still guarded — approved CDN hosts only,
    // re-validated on every redirect hop, https-only, image content-type, and
    // a 10 MB cap enforced while streaming (never buffering the full body).
    if (!imageUrl || typeof imageUrl !== 'string' || isBlockedImportUrl(imageUrl)) {
      return failJson('BAD_REQUEST', 'imageUrl must be an approved https image URL', 400);
    }
    // Admin-typed prompt is still untrusted model input: truncate to 4k chars.
    const safePrompt = clampText(prompt) || 'Enhance the product image for premium ecommerce.';

    // Manual redirect handling: every hop must pass the same host check, so a
    // CDN URL cannot redirect the server-side fetch at an internal service.
    let target = imageUrl;
    let imageResponse: Response | null = null;
    for (let hop = 0; hop <= MAX_IMPORT_REDIRECTS; hop += 1) {
      if (isBlockedImportUrl(target)) {
        return failJson('BAD_REQUEST', 'Redirect target is not an approved image host', 400);
      }
      imageResponse = await fetch(target, { redirect: 'manual' });
      if (imageResponse.status >= 300 && imageResponse.status < 400) {
        const location = imageResponse.headers.get('location');
        if (location) {
          target = new URL(location, target).toString();
          continue;
        }
      }
      break;
    }
    if (!imageResponse || !imageResponse.ok) {
      return failJson('BAD_REQUEST', 'Unable to fetch source image', 400);
    }
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return failJson('BAD_REQUEST', 'Source URL is not an image', 400);
    }
    // Enforce the size cap while streaming: `arrayBuffer()` would buffer the
    // whole body before the check and let a huge response exhaust the server.
    const reader = imageResponse.body?.getReader();
    if (!reader) {
      return failJson('BAD_REQUEST', 'Source URL is not readable', 400);
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return failJson('BAD_REQUEST', 'Source image too large', 413);
      }
      chunks.push(value);
    }
    const blob = new Blob(chunks as BlobPart[], { type: contentType });

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
