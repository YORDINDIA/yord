import type { MediaSource } from '@/lib/data/media';

/**
 * Pure display helpers for the media library.
 *
 * No `'use client'` and no server imports, so both the server page and the
 * client grid/lightbox can use them. `MediaSource` is imported as a *type*
 * only: `lib/data/media.ts` is `server-only`, and a value import would drag
 * that into the browser bundle.
 */

/**
 * Deletion is not wired: the admin has no server action that removes an R2
 * object or its row (`src/server/actions/media.ts` only uploads), and the
 * brief for this page forbids inventing a write path. The control stays in the
 * UI, explains itself, and never claims to have deleted anything — when an
 * action lands, this constant and the two handlers that toast it are the only
 * things to replace.
 */
export const MEDIA_DELETE_UNAVAILABLE =
  'Deleting media is not available yet: no server action removes stored assets. Nothing was changed.';

/** Human-readable byte size. `null` when the bucket did not report one. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/** `1920 × 1080`, or `—` when neither dimension is known. */
export function formatDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!width || !height) return '—';
  return `${width} × ${height}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/**
 * MIME type guessed from the URL's extension.
 *
 * Nothing stores a content type for these assets (`product_images` and
 * `articles` keep dimensions and alt text, not MIME), and the R2 bucket is not
 * guaranteed to answer a cross-origin `HEAD`. The lightbox labels this as
 * derived from the file name rather than pretending it was read from the file.
 */
export function mimeTypeFromUrl(url: string): { type: string; known: boolean } {
  const withoutQuery = url.split(/[?#]/)[0];
  const extension = withoutQuery.split('.').pop()?.toLowerCase() ?? '';
  const type = MIME_BY_EXTENSION[extension];
  return { type: type ?? 'unknown', known: Boolean(type) };
}

/** "Product images" / "Article covers" / "Admin uploads" for the filter chips. */
export function sourceLabel(source: MediaSource): string {
  if (source === 'product') return 'Product';
  if (source === 'article') return 'Article';
  return 'Upload';
}
