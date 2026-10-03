/**
 * Stored-image URL sanity checks.
 *
 * `collections.image_src` still holds the pre-migration Shopify storefront
 * URLs (`http://www.yordindia.com/cdn/shop/...`). Every one of the seven
 * distinct values that survived the migration now 404s, and because the
 * artist helper preferred `storage_image_url || image_src || static hero`, a
 * dead database value hid a perfectly good local `/artists/<handle>-hero.png`.
 *
 * This helper is the gate for that chain: a caller tests each candidate and
 * uses the first usable one, so a dead URL degrades to the next candidate (or
 * the existing gradient placeholder) instead of a broken image. It does not
 * rewrite or delete the stored value — that is an owner/database decision.
 *
 * The rules are deliberately narrow, matching `media-loader.ts`, which has to
 * keep passing R2, Shopify CDN, legacy Supabase and local files through:
 *
 * - the legacy store hosts (`yordindia.com` and its subdomains,
 *   `*.myshopify.com`) no longer serve these files;
 * - a non-`https:` URL is not displayable: an https page blocks it as mixed
 *   content, and every dead URL observed in the database is plain `http`.
 *
 * Root-relative paths (`/artists/coldplay-hero.png`) are displayable — they
 * resolve against the page's own origin.
 */

/** Hosts that used to serve the migrated catalog images and no longer do. */
export const LEGACY_IMAGE_HOSTS = ['yordindia.com', 'www.yordindia.com'];

/** Hosts that used to serve the migrated catalog images and no longer do. */
function isLegacyOrInsecureHost(host: string): boolean {
  const hostname = host.toLowerCase();
  if (LEGACY_IMAGE_HOSTS.includes(hostname)) return true;
  if (hostname === 'myshopify.com' || hostname.endsWith('.myshopify.com')) return true;
  // A store subdomain of the legacy shop platform (`yordindia.myshopify.com`)
  // is covered above; the brand domain covers `cdn.yordindia.com` too.
  return hostname.endsWith('.yordindia.com');
}

/**
 * True when `url` can be handed to `next/image` (or an `<img>`) as-is.
 *
 * Accepts `https:` URLs and root-relative paths; rejects null/empty, anything
 * that is not a parseable absolute URL or root-relative path (e.g. a bare
 * handle, `data:`/`javascript:` payloads), legacy store hosts and plain
 * `http:` URLs.
 */
export function isDisplayableImageUrl(url: string | null | undefined): boolean {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (value === '') return false;
  // Same-origin asset (public/…) — no protocol to validate.
  if (value.startsWith('/') && !value.startsWith('//')) return true;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return !isLegacyOrInsecureHost(parsed.hostname);
}

/**
 * First displayable candidate, or `undefined` when none of them can be shown.
 * Callers use this instead of `a || b || c` chains, which stop at a dead URL.
 */
export function firstDisplayableImageUrl(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const candidate of candidates) {
    if (isDisplayableImageUrl(candidate)) return candidate as string;
  }
  return undefined;
}
