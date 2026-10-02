/**
 * Host allowlist for AI image imports (`/api/ai/image`).
 *
 * Imports are limited to the CDNs a product cover can come from: the Shopify
 * hosts the migration pulls media from, the project's own R2 bucket, and the
 * legacy Supabase Storage bucket, which may still serve rows migrated before
 * the storage switch. The route hands the URL to Agnes AI, which fetches it,
 * so this check is what keeps a non-public or credential-bearing URL from
 * leaving the server inside a provider request.
 */

export const ALLOWED_IMPORT_HOSTS = [
  'cdn.shopify.com',
  'shopifycdn.com',
  'cdn.shopifycdn.net',
] as const;

/** Path prefix of a publicly readable Supabase Storage object. */
const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/';

/**
 * Host of the project's own storage bucket, or `null` when the project URL is
 * unset or unparseable (a backend-less build). Only the public object path on
 * this host is importable, so the route cannot be used to read the Supabase
 * API (`/rest/v1/...`) or a private bucket through it.
 */
export function legacyStorageHost(
  projectUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  try {
    return new URL(projectUrl ?? '').hostname || null;
  } catch {
    return null;
  }
}

/** Environment keys the media allowlist reads. */
export interface MediaHostEnv {
  R2_PUBLIC_BASE_URL?: string;
  NEXT_PUBLIC_MEDIA_BASE_URL?: string;
}

/**
 * Hosts the media bucket answers on: `R2_PUBLIC_BASE_URL` (the URL stored in
 * the database) and `NEXT_PUBLIC_MEDIA_BASE_URL` (the custom domain the
 * storefront may rewrite to later). Either may be unset at build time.
 */
export function mediaHosts(env: MediaHostEnv = process.env as MediaHostEnv): string[] {
  const hosts: string[] = [];
  for (const value of [env.R2_PUBLIC_BASE_URL, env.NEXT_PUBLIC_MEDIA_BASE_URL]) {
    if (!value) continue;
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host) hosts.push(host);
    } catch {
      // Ignore unparseable values; an empty allowlist entry would only make
      // the check stricter, never looser.
    }
  }
  return hosts;
}

/**
 * True when `value` is an https URL this route may import, without credentials.
 *
 * `storageHost` / `media` are injectable for tests; both default to the
 * environment.
 */
export function isAllowedImportUrl(
  value: string,
  storageHost: string | null = legacyStorageHost(),
  media: string[] = mediaHosts(),
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (media.includes(host)) return true;

  if (storageHost && host === storageHost) {
    return url.pathname.startsWith(PUBLIC_STORAGE_PATH);
  }
  return ALLOWED_IMPORT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}
