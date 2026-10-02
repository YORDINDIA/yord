/**
 * HTML sanitizer for merchant/Shopify-migrated HTML rendered via
 * dangerouslySetInnerHTML. Server-safe: strips scripts, event handlers and
 * dangerous URL schemes (including entity-encoded ones a regex misses).
 * isomorphic-dompurify pulls jsdom+undici, which breaks vitest on Node 20
 * (undici needs worker_threads.markAsUncloneable, added in Node 22),
 * so this uses a dependency-free sanitizer instead.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  let out = String(html);
  // Decode numeric/element entities first so encoded payloads can't slip past.
  out = out
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&(lt|gt|amp|quot|#39|#x27|#x2f);?/gi, (m) => {
      switch (m.toLowerCase()) {
        case '&lt;': return '<';
        case '&gt;': return '>';
        case '&amp;': return '&';
        case '&quot;': return '"';
        case '&#39;':
        case '&#x27;': return "'";
        case '&#x2f;': return '/';
        default: return m;
      }
    });
  // Strip script/style/iframe/object/embed/link/meta/base/form elements entirely.
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|noscript|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|noscript|template)[^>]*\/?\s*>/gi, '');
  // Strip event-handler attributes (onclick=, onerror=, ...) quoted or not.
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralize javascript:/data:/vbscript: URLs in href/src/xlink:href/action.
  out = out.replace(/\s(href|src|xlink:href|action)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, attr, val) => {
    const raw = String(val).replace(/^['"]|['"]$/g, '').replace(/[\s\u0000-\u001F]+/g, '').toLowerCase();
    if (/^(javascript|data|vbscript|file|blob):/.test(raw)) return ` ${attr}="#"`;
    return m;
  });
  return out;
}
