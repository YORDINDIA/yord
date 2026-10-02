/**
 * Media loader for `next/image`.
 *
 * The bucket stores exactly one web-optimized variant per image (WebP, max
 * 1600px — see `scripts/utils/r2_helpers.py`), so there is nothing left to
 * transform at request time: this loader returns the stored URL unchanged.
 * Keeping a custom loader is deliberate — Next's built-in optimizer would
 * otherwise fetch and re-encode every image through a serverless function,
 * which costs money on Netlify and cannot run on Cloudflare Workers.
 *
 * It also owns the move from Cloudflare's development URL to a custom domain:
 * when `NEXT_PUBLIC_MEDIA_BASE_URL` is set, any stored `*.r2.dev` URL is
 * rewritten to that origin, keeping the path and query. That makes the switch
 * a one-line environment change instead of a database rewrite.
 *
 * Next bundles this file on its own and expects a default export, so it
 * deliberately imports nothing (see `images.loaderFile` in `next.config.ts`).
 */

export type MediaLoaderArgs = {
  src: string;
  width: number;
  quality?: number;
};

/** True for a URL served by Cloudflare's r2.dev development subdomain. */
export function isR2DevUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname.toLowerCase().endsWith('.r2.dev');
  } catch {
    return false;
  }
}

/**
 * Delivery URL for one `srcset` entry.
 *
 * `width` and `quality` are accepted because Next passes them, and ignored
 * because the stored variant already fits every breakpoint.
 */
export function mediaLoader(
  { src }: MediaLoaderArgs,
  mediaBaseUrl: string | undefined = process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
): string {
  const override = mediaBaseUrl?.trim().replace(/\/+$/, '');
  if (!override || !override.startsWith('https://') || !isR2DevUrl(src)) {
    return src;
  }
  const { pathname, search } = new URL(src);
  return `${override}${pathname}${search}`;
}

export default mediaLoader;
