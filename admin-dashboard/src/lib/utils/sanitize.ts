/**
 * Decode every character reference that can smuggle a URL scheme past the
 * check below. `href="javascript&colon;alert(1)"` has no literal colon, so a
 * scheme test on the raw string passes — but the browser decodes `&colon;`
 * before navigating, making it a live `javascript:` link (stored XSS, since
 * this column renders via dangerouslySetInnerHTML). Numeric references were
 * already decoded; named ones were not.
 *
 * Decoded iteratively to a fixpoint so double-encoded payloads
 * (`&amp;colon;` → `&colon;` → `:`) cannot peel off one layer per save.
 * Over-decoding is the safe direction here: anything decoded is then checked
 * by the element/attribute/scheme strippers below.
 */
const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  semi: ';',
  comma: ',',
  sol: '/',
  bsol: '\\',
  NewLine: '\n',
  Tab: '\t',
  excl: '!',
  quest: '?',
 lpar: '(',  rpar: ')',
  period: '.',
  midast: '*',
  lowbar: '_',
  hyphen: '-',
  num: '#',
  dollar: '$',
  percnt: '%',
  plus: '+',
  equals: '=',
  Hat: '^',
  brvbar: '|',
  tilde: '~',
  grave: '`',
  trade: '™',
  copy: '©',
  reg: '®',
  curren: '¤',
  iexcl: '¡',
  iquest: '¿',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  lsaquo: '‹',
  rsaquo: '›',
  oline: '‾',
  frasl: '⁄',
  euro: '€',
  hellip: '…',
  prime: '′',
  Prime: '″',
  oelig: 'œ',
  OElig: 'Œ',
  scaron: 'š',
  Scaron: 'Š',
  yuml: 'ÿ',
  Yuml: 'Ÿ',
  fnof: 'ƒ',
  Alpha: 'Α',
  Beta: 'Β',
  Gamma: 'Γ',
  Delta: 'Δ',
  Epsilon: 'Ε',
  Omega: 'Ω',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  pi: 'π',
  omega: 'ω',
  Agrave: 'À',
  Aacute: 'Á',
  Acirc: 'Â',
  Atilde: 'Ã',
  Auml: 'Ä',
  Aring: 'Å',
  AElig: 'Æ',
  Ccedil: 'Ç',
  Egrave: 'È',
  Eacute: 'É',
  Ecirc: 'Ê',
  Euml: 'Ë',
  Igrave: 'Ì',
  Iacute: 'Í',
  Icirc: 'Î',
  Iuml: 'Ï',
  Ntilde: 'Ñ',
  Ograve: 'Ò',
  Oacute: 'Ó',
  Ocirc: 'Ô',
  Otilde: 'Õ',
  Ouml: 'Ö',
  Oslash: 'Ø',
  Ugrave: 'Ù',
  Uacute: 'Ú',
  Ucirc: 'Û',
  Uuml: 'Ü',
  Yacute: 'Ý',
  THORN: 'Þ',
  szlig: 'ß',
  agrave: 'à',
  aacute: 'á',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  aring: 'å',
  aelig: 'æ',
  ccedil: 'ç',
  egrave: 'è',
  eacute: 'é',
  ecirc: 'ê',
  euml: 'ë',
  igrave: 'ì',
  iacute: 'í',
  icirc: 'î',
  iuml: 'ï',
  ntilde: 'ñ',
  ograve: 'ò',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  oslash: 'ø',
  ugrave: 'ù',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  yacute: 'ý',
  thorn: 'þ',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  times: '×',
  divide: '÷',
  sect: '§',
  para: '¶',
  middot: '·',
 uml: '¨',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  plusmn: '±',
  micro: 'µ',
 ETH: 'Ð',
  eth: 'ð',
};

function decodeEntitiesOnce(html: string): string {
  return html
    .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);?/g, (m, name: string) => {
      // Case-sensitive first (spec behavior), then case-insensitive so
      // `&COLON;` cannot smuggle a scheme past the check either.
      if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)) {
        return NAMED_ENTITIES[name];
      }
      const lower = name.toLowerCase();
      for (const key of Object.keys(NAMED_ENTITIES)) {
        if (key.toLowerCase() === lower) return NAMED_ENTITIES[key];
      }
      return m;
    });
}

function decodeEntities(html: string): string {
  // Loop to a fixpoint instead of a fixed pass count. A fixed cap is a bypass:
  // five nested `&amp;` layers around `&colon;` need six passes, so the old
  // five-pass loop left `href="javascript&colon;alert(1)"` standing — no
  // literal colon for the scheme check to see, but the browser decodes it
  // before navigating. The loop always terminates: every entity expands to
  // fewer characters than its source, so any pass that changes the string
  // strictly shrinks it.
  let out = html;
  for (;;) {
    const next = decodeEntitiesOnce(out);
    if (next === out) return out;
    out = next;
  }
}
/**
 * Sanitize admin-authored HTML before it is stored.
 *
 * `body_html` / `summary_html` are written by admins and later rendered with
 * dangerouslySetInnerHTML (ai/listing, ai/blog previews and the storefront), so
 * they must not carry script/style/embedded content, event-handler attributes,
 * or `javascript:`-family URLs.
 *
 * Dependency-free on purpose: isomorphic-dompurify pulls jsdom+undici, which
 * breaks vitest on Node 20 (undici needs `worker_threads.markAsUncloneable`,
 * added in Node 22). Same approach as the storefront's sanitizeHtml.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  // Decode numeric/element entities first so encoded payloads cannot slip past.
  let out = decodeEntities(String(html));
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
