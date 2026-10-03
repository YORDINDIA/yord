'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionState } from '@/lib/action-state';
import { isStorageConfigured, uploadImageBuffer } from '@/lib/r2';
import {
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_FILES,
  isOneOf,
} from '@/lib/constants';
import { CONTENT_TYPE_BY_FORMAT, sniffImageFormat } from '@/lib/media-format';
import { audit, withAdmin } from './_shared';

/**
 * Media upload.
 *
 * This used to run entirely in the browser: `media/uploader.tsx` took the anon
 * key and called `supabase.storage.from('products').upload(...)` directly. That
 * meant the write was gated only by RLS on the storage bucket, not by
 * `requireAdmin()`, and nothing about it appeared in the audit log. The browser
 * now posts `FormData` to this action, which uploads to Cloudflare R2 after an
 * explicit admin check. The same 10 MB / 10 file / MIME allowlist is enforced
 * here as in the client hint, and the stored format is sniffed from the bytes
 * rather than trusted from the client's `type`.
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
    if (!isStorageConfigured()) {
      return actionError(
        'Image storage is not configured. Set the R2_* variables (see docs/deploy.md).',
      );
    }

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

      const buffer = Buffer.from(await file.arrayBuffer());

      // The declared MIME is a client hint; the leading bytes decide what is
      // actually stored. The uploader sends WebP when its browser can encode
      // it and the original file otherwise, so both arrive here.
      const format = sniffImageFormat(buffer);
      if (!format) {
        failures.push(`${file.name}: not a readable JPEG, PNG, or WebP image.`);
        continue;
      }

      const key = `admin/${randomUUID()}`;
      try {
        const result = await uploadImageBuffer(buffer, {
          key,
          contentType: CONTENT_TYPE_BY_FORMAT[format],
        });
        uploaded.push(result.url);
      } catch (error) {
        console.error('[media] upload failed', key, error);
        failures.push(`${file.name}: upload failed.`);
      }
    }

    if (uploaded.length === 0) {
      return actionError(
        failures[0] ?? 'No images could be uploaded. Nothing was saved.',
      );
    }

    await audit(context, {
      action: 'upload_media',
      entity: 'storage',
      entityId: 'r2',
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
