export const runtime = 'nodejs';

import { agnesBaseUrl, buildImageEditBody } from '@/lib/ai/agnes';
import { assertAiAllowed } from '@/lib/ai/guard';
import { isAllowedImportUrl } from '@/lib/ai/import-hosts';
import { isStorageConfigured, uploadImageBuffer } from '@/lib/r2';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/utils/admin';
import { clampText, failJson, okJson } from '@/lib/utils/prompt';

/** Reject URLs that are not approved public CDN images or smuggle credentials. */
function isBlockedImportUrl(value: string): boolean {
  return !isAllowedImportUrl(value);
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { service } = auth;

    const denied = assertAiAllowed(auth.user.id);
    if (denied) return denied;

    if (!process.env.AGNES_AI_API_KEY) {
      return failJson('NOT_CONFIGURED', 'Image service not configured', 500);
    }
    if (!isStorageConfigured()) {
      return failJson('NOT_CONFIGURED', 'Image storage not configured', 500);
    }

    const { imageUrl, prompt } = await req.json();
    // Accept the cover URL as stored, which is one of three things: the
    // Shopify CDN `src`, an R2 upload, or a legacy Supabase asset from before
    // the storage switch. Rejecting any of them made image generation fail for
    // those products. The URL is passed to Agnes, which fetches it, so this
    // allowlist is what keeps a non-public or credential-bearing URL from
    // leaving the server; there is no server-side fetch left to redirect.
    if (!imageUrl || typeof imageUrl !== 'string' || isBlockedImportUrl(imageUrl)) {
      return failJson('BAD_REQUEST', 'imageUrl must be an approved https image URL', 400);
    }
    // Admin-typed prompt is still untrusted model input: truncate to 4k chars.
    const safePrompt = clampText(prompt) || 'Enhance the product image for premium ecommerce.';

    const aiResponse = await fetch(`${agnesBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AGNES_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildImageEditBody(safePrompt, imageUrl)),
      // Agnes recommends a 60-360s client timeout; generations completed well
      // under a minute in testing, and without a cap a hung upstream would
      // hold the request (and the Worker) open.
      signal: AbortSignal.timeout(300_000),
    });

    if (!aiResponse.ok) {
      console.error('Agnes image edit failed', aiResponse.status);
      return failJson('UPSTREAM_INVALID', 'Image generation failed', 502);
    }

    const result = await aiResponse.json();
    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      return failJson('UPSTREAM_EMPTY', 'Image generation failed', 500);
    }

    const buffer = Buffer.from(b64, 'base64');
    const supabase = service ?? createServiceClient();
    // Agnes returns PNG at 1024px (1K / 1:1); the storefront's variant policy
    // does not apply here (no browser canvas on the server), so the PNG is
    // stored as-is and flagged in the media docs.
    const key = `ai/${Date.now()}`;
    let uploaded: { url: string; key: string };
    try {
      uploaded = await uploadImageBuffer(buffer, { key, contentType: 'image/png' });
    } catch (error) {
      console.error('R2 upload failed', error);
      return failJson('INTERNAL', 'Image upload failed', 500);
    }

    const { data: job, error: jobError } = await supabase
      .from('ai_jobs')
      .insert({ type: 'image', status: 'complete', input_ref: imageUrl })
      .select('id')
      .single();
    if (jobError) {
      console.error('ai_jobs insert failed', jobError);
      return okJson(
        { previewUrl: uploaded.url, storagePath: uploaded.key },
        { previewUrl: uploaded.url, storagePath: uploaded.key }
      );
    }

    const { error: assetError } = await supabase.from('ai_assets').insert({
      job_id: job?.id || null,
      storage_path: uploaded.key,
      preview_url: uploaded.url,
      metadata: { prompt: safePrompt || null },
    });
    if (assetError) {
      console.error('ai_assets insert failed', assetError);
    }

    return okJson(
      { previewUrl: uploaded.url, storagePath: uploaded.key },
      { previewUrl: uploaded.url, storagePath: uploaded.key }
    );
  } catch (error: unknown) {
    console.error('Image route failed', error);
    return failJson('INTERNAL', 'Image generation failed', 500);
  }
}
