'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import {
  ALLOWED_MEDIA_EXTENSIONS,
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_FILES,
  isOneOf,
} from '@/lib/constants';
import { audit, withAdmin } from './_shared';

/**
 * Media upload.
 *
 * This used to run entirely in the browser: `media/uploader.tsx` took the anon
 * key and called `supabase.storage.from('products').upload(...)` directly. That
 * meant the write was gated only by RLS on the storage bucket, not by
 * `requireAdmin()`, and nothing about it appeared in the audit log. The browser
 * now posts `FormData` to this action, which uploads with the service client
 * after an explicit admin check. The same 10 MB / 10 file / MIME allowlist is
 * enforced here as in the client hint.
 */
export async function uploadMediaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState<{ urls: string[] }>> {
  return withAdmin<{ urls: string[] }>(async (context) => {
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) return actionError('No files were received.');
    if (files.length > MAX_MEDIA_FILES) {
      return actionError(`Upload at most ${MAX_MEDIA_FILES} images at a time.`);
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'products';
    const uploaded: string[] = [];
    const failures: string[] = [];

    for (const file of files) {
      if (!isOneOf(ALLOWED_MEDIA_TYPES, file.type)) {
        failures.push(`${file.name}: only JPG, PNG, and WebP are allowed.`);
        continue;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        failures.push(`${file.name}: exceeds the 10 MB limit.`);
        continue;
      }

      const extension = (file.name.split('.').pop()?.toLowerCase() ?? '').replace(/[^a-z0-9]/g, '');
      const safeExtension = isOneOf(ALLOWED_MEDIA_EXTENSIONS, extension) ? extension : 'bin';
      const path = `admin/${randomUUID()}.${safeExtension}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await context.service.storage
        .from(bucket)
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (error) {
        console.error('[media] upload failed', path, error);
        failures.push(`${file.name}: ${error.message}`);
        continue;
      }

      const { data } = context.service.storage.from(bucket).getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    if (uploaded.length === 0) {
      return actionError(
        failures[0] ?? 'No images could be uploaded. Nothing was saved.',
      );
    }

    await audit(context, {
      action: 'upload_media',
      entity: 'storage',
      entityId: bucket,
      after: { count: uploaded.length, urls: uploaded },
    });

    revalidatePath('/media');

    if (failures.length > 0) {
      return {
        status: 'success',
        message: `Uploaded ${uploaded.length}. ${failures.join(' ')}`,
        data: { urls: uploaded },
      };
    }
    return actionOk<{ urls: string[] }>(
      `Uploaded ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}.`,
      { urls: uploaded },
    );
  });
}
