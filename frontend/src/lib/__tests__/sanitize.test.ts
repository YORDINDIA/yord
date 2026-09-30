// sanitizeHtml tests: merchant HTML must render without scripts, event
// handlers, or dangerous URL schemes — including entity-encoded payloads.
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('keeps safe markup', () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>',
    );
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('strips script/style/iframe elements entirely', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).toBe('');
  });

  it('strips event-handler attributes', () => {
    expect(sanitizeHtml('<img src="x.jpg" onerror="alert(1)">')).toBe('<img src="x.jpg">');
    expect(sanitizeHtml("<a href=\"/p\" onclick='steal()'>x</a>")).toBe('<a href="/p">x</a>');
  });

  it('neutralizes dangerous URL schemes', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="  JaVaScRiPt:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="/products">x</a>')).toBe('<a href="/products">x</a>');
  });

  it('catches entity-encoded payloads', () => {
    expect(sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('');
    expect(sanitizeHtml('<img src="x" onerror=&#97;&#108;&#101;&#114;&#116;(1)>')).toBe(
      '<img src="x">',
    );
  });
});
