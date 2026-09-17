export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function slugify(value: string, fallback = 'ai-draft'): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    // Own Supabase project's storage only. A blanket *.supabase.co allowlist
    // would let an admin SSRF arbitrary third-party Supabase buckets through
    // the image-edit fetch; the project host comes from env so previews and
    // local dev keep working.
    const projectHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .replace(/^https?:\/\//, '')
      .split(/[/?#]/)[0]
      ?.toLowerCase();
    if (!projectHost) return false;
    return host === projectHost;
  } catch {
    return false;
  }
}
