/**
 * HTML sanitizer for merchant/Shopify-migrated HTML rendered via
 * dangerouslySetInnerHTML. Server-safe: strips script-capable elements, event
 * handlers and dangerous URL schemes — including entity-encoded ones a naive
 * regex misses.
 *
 * Twin of `admin-dashboard/src/lib/utils/sanitize.ts`: both guard the same
 * column family (`products`/`collections`/`articles` `body_html`) and the admin
 * cannot import from the storefront, so they are separate files. They have
 * drifted before — the admin grew the fixpoint entity decode below and the
 * storefront never got it, which is how `href="javascript&colon;alert(1)"`
 * stayed live here. Keep the decoder and the three strippers in step.
 *
 * isomorphic-dompurify pulls jsdom+undici, which breaks vitest on Node 20
 * (undici needs worker_threads.markAsUncloneable, added in Node 22),
 * so this uses a dependency-free sanitizer instead.
 */

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
  lpar: '(',
  rpar: ')',
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
    // `&#X6a;` is as valid to the browser as `&#x6a;` (the HTML spec accepts
    // both cases), so a lowercase-only `x` left `&#X6a;avascript:` clickable.
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
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
  // five nested `&amp;` layers around `&colon;` need six passes, so a capped
  // loop leaves `href="javascript&colon;alert(1)"` standing — no literal colon
  // for the scheme check to see, but the browser decodes it before navigating.
  // The loop always terminates: every entity expands to fewer characters than
  // its source, so any pass that changes the string strictly shrinks it.
  let out = html;
  for (;;) {
    const next = decodeEntitiesOnce(out);
    if (next === out) return out;
    out = next;
  }
}

/**
 * Script-capable / embed-capable elements, dropped with their content.
 *
 * `svg` and `math` are on the list because they are foreign-content containers
 * that carry their own event attributes (`<svg/onload=…>` fires on insertion,
 * with no user interaction) and enable the mXSS `<math><mtext><style>`
 * re-parse trick. One list, three compiled patterns, so they cannot drift:
 * paired element with its content, leftover open/self-closing tag, and a stray
 * closing tag whose open tag is not in this string.
 */
const STRIPPED_ELEMENTS =
  'script|style|iframe|object|embed|link|meta|base|form|noscript|template|svg|math';
const STRIPPED_WITH_CONTENT = new RegExp(
  `<\\s*(${STRIPPED_ELEMENTS})[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
  'gi',
);
const STRIPPED_TAGS = new RegExp(`<\\s*(${STRIPPED_ELEMENTS})[^>]*>`, 'gi');
const STRIPPED_END_TAGS = new RegExp(`<\\s*/\\s*(${STRIPPED_ELEMENTS})\\s*>`, 'gi');

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  // Every pass runs again until the output stops changing. One pass is a
  // bypass: removing an inner tag rejoins the text around it, so
  // `<ifr<script>ame srcdoc=…>` becomes a live `<iframe>` after a single
  // sweep. Each pass that changes the string shrinks it, so the loop ends.
  let out = String(html);
  let prev: string;
  do {
    prev = out;
    out = decodeEntities(out);
    // Drop dangerous elements with their content, then any leftover open or
    // closing tag.
    out = out.replace(STRIPPED_WITH_CONTENT, '');
    out = out.replace(STRIPPED_TAGS, '');
    out = out.replace(STRIPPED_END_TAGS, '');
    // Strip event-handler attributes (onclick=, onerror=, ...), quoted or not.
    // An attribute can follow whitespace, a `/` (`<svg/onload=…>`), a quote (the
    // previous attribute's closing quote) or the start of the input — requiring
    // `\s+` here is how `<svg/onload=…>` got through. The prefix character is
    // captured and put back so the match cannot eat the quote that opens or
    // closes a neighbouring attribute.
    out = out.replace(/(^|[\s/"'])(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    // Neutralize javascript:/data:/vbscript: URLs in
    // href/src/xlink:href/action/formaction.
    // Same prefix rule as the event handlers: `<a/href="javascript:…">` is a real
    // attribute to the browser, and a bare `\s` missed it.
    out = out.replace(
      /(^|[\s/"'])(href|src|xlink:href|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (m, prefix: string, attr: string, val: string) => {
        const raw = String(val)
          .replace(/^['"]|['"]$/g, '')
          .replace(/[\s\u0000-\u001F]+/g, '')
          .toLowerCase();
        if (/^(javascript|data|vbscript|file|blob):/.test(raw)) return `${prefix}${attr}="#"`;
        return m;
      },
    );
  } while (out !== prev);
  return out;
}
