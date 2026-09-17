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
    return (
      host.endsWith('.supabase.co') ||
      host.endsWith('.supabase.in') ||
      host.endsWith('supabase.co') ||
      host.endsWith('supabase.in')
    );
  } catch {
    return false;
  }
}
