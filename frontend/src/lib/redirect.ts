// Allow only same-origin in-app paths as post-auth redirects.
// Rejects absolute URLs, protocol-relative URLs, and backslash tricks.
export function getSafeRedirect(value: string | null, fallback = '/account'): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback;
  try {
    const url = new URL(trimmed, 'https://yord.local');
    const path = url.pathname + url.search + url.hash;
    if (!path.startsWith('/')) return fallback;
    return path.slice(0, 500);
  } catch {
    return fallback;
  }
}
