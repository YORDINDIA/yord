/**
 * Client-side variant policy for media uploads.
 *
 * R2 stores bytes verbatim, so the browser produces the one web-optimized
 * variant every image gets: WebP, at most 1600px wide (the same policy the
 * Python scripts apply — see `scripts/utils/r2_helpers.py`). Doing it in the
 * browser also means the upload is a fraction of the original size, and the
 * server needs no native image tooling (Cloudflare Workers cannot run `sharp`).
 *
 * These helpers are pure so they can be tested without a DOM; the canvas glue
 * lives in `media/uploader.tsx`.
 */

export const VARIANT_MAX_WIDTH = 1600;
export const VARIANT_QUALITY = 0.82;

/** Downscale dimensions to fit `maxWidth`, preserving the aspect ratio. */
export function variantDimensions(
  width: number,
  height: number,
  maxWidth: number = VARIANT_MAX_WIDTH,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  if (width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

/** File name for the converted upload; the server re-derives the extension. */
export function variantFileName(name: string): string {
  const stem = name.replace(/\.[^./\\]{1,5}$/, '');
  return `${stem || 'image'}.webp`;
}
