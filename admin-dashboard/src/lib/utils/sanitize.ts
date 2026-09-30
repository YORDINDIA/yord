/**
 * Sanitize admin-authored HTML before it is stored.
 *
 * `body_html` / `summary_html` are written by admins and later rendered with
 * dangerouslySetInnerHTML (ai/listing, ai/blog previews and the storefront), so
 * they must not carry script/style/embedded content, event-handler attributes,
 * or `javascript:`-family URLs.
 *
 * Dependency-free on purpose: isomorphic-dompurify pulls jsdom+undici, which
 * breaks vitest on Node 20 (undici needs worker_threads.markAsUncloneable,
 * added in Node 22). Same approach as the storefront's sanitizeHtml.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = String(html);
  // Decode numeric/element entities first so encoded payloads cannot slip past.
  out = out
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&(lt|gt|amp|quot|#39|#x27|#x2f);?/gi, (m) => {
      switch (m.toLowerCase()) {
        case '&lt;':
          return '<';
        case '&gt;':
          return '>';
        case '&amp;':
          return '&';
        case '&quot;':
          return '"';
        case '&#39;':
        case '&#x27;':
          return "'";
        case '&#x2f;':
          return '/';
        default:
          return m;
      }
    });
  // Drop dangerous elements with their content, then any leftover open tags.
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|noscript|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|noscript|template)[^>]*\/?\s*>/gi,
    '',
  );
  // Strip event-handler attributes (onclick=, onerror=, ...), quoted or not.
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralize javascript:/data:/vbscript: and friends in URL attributes.
  out = out.replace(
    /\s(href|src|xlink:href|action)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    (m, attr: string, val: string) => {
      const raw = String(val)
        .replace(/^['"]|['"]$/g, '')
        .replace(/[\s\u0000-\u001F]+/g, '')
        .toLowerCase();
      if (/^(javascript|data|vbscript|file|blob):/.test(raw)) return ` ${attr}="#"`;
      return m;
    },
  );
  return out;
}

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
