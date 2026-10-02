// Allow only same-origin in-app paths as post-auth redirects.
// Rejects absolute URLs, protocol-relative URLs, and backslash tricks.
export function getSafeRedirect(value: string | null, fallback = '/account'): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback;
  // Browsers treat `\` as `/` for special schemes, so `/\evil.com` and
  // dot-segment tricks like `/a/..\/evil.com` normalize to a
  // protocol-relative URL (https://evil.com/). Reject any backslash before
  // parsing, then verify the parsed URL never leaves the dummy origin and
  // the extracted path is not protocol-relative.
  if (trimmed.includes('\\')) return fallback;
  try {
    const url = new URL(trimmed, 'https://yord.local');
    if (url.origin !== 'https://yord.local') return fallback;
    const path = url.pathname + url.search + url.hash;
    if (!path.startsWith('/') || path.startsWith('//')) return fallback;
    return path.slice(0, 500);
  } catch {
    return fallback;
  }
}
