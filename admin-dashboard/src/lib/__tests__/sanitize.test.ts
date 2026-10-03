import { describe, expect, it } from 'vitest';
import { sanitizeHtml, slugify } from '@/lib/utils/sanitize';

/**
 * Admin-authored and model-generated HTML, before it is stored.
 *
 * `body_html` and `summary_html` are written by admins and by the AI studio, and are later rendered with `dangerouslySetInnerHTML` in the AI
 * previews and on the storefront. Two of the three article writers stored the
 * value unsanitized.
 *
 * Dependency-free on purpose: isomorphic-dompurify pulls jsdom+undici, which
 * breaks vitest on Node 20 (undici needs `worker_threads.markAsUncloneable`,
 * added in Node 22). Same approach as the storefront's sanitizer.
 */
describe('sanitizeHtml', () => {
  it('passes ordinary formatting markup through', () => {
    const html = '<p>A <strong>bold</strong> claim and a <a href="https://yord.in">link</a>.</p>';
    expect(sanitizeHtml(html)).toContain('<strong>bold</strong>');
    expect(sanitizeHtml(html)).toContain('href="https://yord.in"');
  });

  it('removes script elements and their content', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('ok');
  });

  it('removes style, iframe, object, and embed', () => {
    expect(sanitizeHtml('<style>body{display:none}</style>')).not.toContain('display:none');
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).not.toContain('iframe');
    expect(sanitizeHtml('<object data="x"></object>')).not.toContain('object');
    expect(sanitizeHtml('<embed src="x">')).not.toContain('embed');
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).toContain('src="x"');
  });

  it('neutralizes javascript: and data: URLs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="#"');
  });

  it('sees through entity-encoded payloads', () => {
    // Numeric entities are decoded first, so an encoded `<script>` cannot slip
    // past the element matchers.
    const encoded = '&#60;script&#62;alert(1)&#60;/script&#62;';
    expect(sanitizeHtml(encoded)).not.toContain('script');
  });

  it('decodes nested entity layers to a fixpoint before the scheme check', () => {
    // `javascript&colon;alert(1)` has no literal colon, so the scheme check
    // cannot see it — but the browser decodes the entity before navigating.
    // The decode must run to a fixpoint BEFORE the check: five nested `&amp;`
    // layers (`&amp;amp;amp;amp;amp;colon;`) need six passes, and a capped
    // loop leaves the innermost layer standing for the browser to peel off.
    const nested = (depth: number) =>
      `<a href="javascript&${'amp;'.repeat(depth)}colon;alert(1)">x</a>`;
    for (let depth = 1; depth <= 8; depth += 1) {
      const out = sanitizeHtml(nested(depth));
      expect(out, `depth ${depth}`).toContain('href="#"');
      expect(out, `depth ${depth}`).not.toContain('javascript');
      expect(out, `depth ${depth}`).not.toContain('&colon;');
    }
  });

  it('decodes nested numeric references the same way', () => {
    // `&amp;#106;avascript:` peels to `javascript:` one layer per pass; a
    // deeper stack must not survive as a clickable link either.
    const deep = '<a href="&amp;amp;amp;#106;avascript:alert(1)">x</a>';
    const out = sanitizeHtml(deep);
    expect(out).toContain('href="#"');
    expect(out).not.toContain('avascript');
  });

  it('handles empty and nullish input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('slugify', () => {
  it('produces a url-safe slug', () => {
    expect(slugify('Coldplay Tour 2025!')).toBe('coldplay-tour-2025');
  });

  it('collapses separators and trims dashes', () => {
    expect(slugify('  --Hello__World--  ')).toBe('hello-world');
  });

  it('uses the fallback when nothing survives', () => {
    expect(slugify('!!!', 'fallback')).toBe('fallback');
    expect(slugify('', 'ai-draft-9')).toBe('ai-draft-9');
  });
});
