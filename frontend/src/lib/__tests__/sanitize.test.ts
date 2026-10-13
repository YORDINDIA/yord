// sanitizeHtml tests: merchant HTML must render without scripts, event
// handlers, or dangerous URL schemes — including entity-encoded payloads.
//
// Every bypass below was reproduced against this module before the fix (the
// storefront twin of the admin sanitizer had drifted: no fixpoint entity
// decode, and both strippers required a leading whitespace before the
// attribute name).
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('keeps safe markup', () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>',
    );
    expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>',
    );
    expect(sanitizeHtml('<a href="mailto:a@b.com">mail</a>')).toBe('<a href="mailto:a@b.com">mail</a>');
    expect(sanitizeHtml('<img src="https://cdn.example.com/a.webp" alt="shirt">')).toBe(
      '<img src="https://cdn.example.com/a.webp" alt="shirt">',
    );
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('does not mistake prose containing "on" and "=" for an attribute', () => {
    // The event-handler matcher must not fire on words that merely start with
    // "on" followed by "=". Note "on = yes": `on` plus a space cannot be a
    // handler name, which is why the pattern requires letters after `on`.
    expect(sanitizeHtml('<p>Order 2 = 4 and so on = yes</p>')).toBe(
      '<p>Order 2 = 4 and so on = yes</p>',
    );
    expect(sanitizeHtml('<p>Buy one, get one on = free</p>')).toBe(
      '<p>Buy one, get one on = free</p>',
    );
  });

  it('strips script/style/iframe elements entirely', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).toBe('');
  });

  it('strips svg and math containers, which are script-capable', () => {
    // `<svg/onload=…>` fires on insertion with no user interaction, and `svg`
    // was not on the stripped-element list, so it survived even when the
    // handler attribute was removed.
    expect(sanitizeHtml('<svg/onload=alert(1)>')).toBe('');
    expect(sanitizeHtml('<svg/onload =alert(1)>')).toBe('');
    expect(sanitizeHtml('<svg/onLoad=alert(1)>')).toBe('');
    expect(sanitizeHtml('<svg onload=alert(1)>')).toBe('');
    expect(sanitizeHtml('<svg><script>alert(1)</script></svg>')).toBe('');
    expect(sanitizeHtml('</svg><p>ok</p>')).toBe('<p>ok</p>');
    expect(
      sanitizeHtml('<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>'),
    ).not.toContain('onerror');
  });

  it('strips event-handler attributes', () => {
    expect(sanitizeHtml('<img src="x.jpg" onerror="alert(1)">')).toBe('<img src="x.jpg" >');
    expect(sanitizeHtml("<a href=\"/p\" onclick='steal()'>x</a>")).toBe('<a href="/p" >x</a>');
    expect(sanitizeHtml('<IMG SRC=x onerror=alert(1)>')).not.toContain('onerror');
    expect(sanitizeHtml('<body onload=alert(1)>')).not.toContain('onload');
  });

  it('strips event handlers whose separator is a slash, not whitespace', () => {
    // The old pattern required `\s+` before `on…=`, so the slash-separated
    // form was never matched.
    expect(sanitizeHtml('<img/src=x/onerror=alert(1)>')).not.toContain('onerror');
    expect(sanitizeHtml('<svg/onload=alert(1)>')).not.toContain('onload');
  });

  it('neutralizes dangerous URL schemes', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="  JaVaScRiPt:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="/products">x</a>')).toBe('<a href="/products">x</a>');
  });

  it('neutralizes URL attributes whose separator is a slash or a quote', () => {
    // `<a/href=…>` and `<a title="x"href=…>` are both real attributes to the
    // browser; only the first was caught by the old `\s(href|src|…)` pattern.
    expect(sanitizeHtml('<a/href="javascript:alert(1)">x</a>')).toBe('<a/href="#">x</a>');
    expect(sanitizeHtml('<a title="x"href="javascript:alert(1)">x</a>')).toBe(
      '<a title="x"href="#">x</a>',
    );
  });

  it('neutralizes formaction, which can carry a scheme like href', () => {
    // A button's formaction overrides the form's action at submit time, so a
    // javascript: value there is as live as one in href.
    expect(sanitizeHtml('<button formaction="javascript:alert(1)">x</button>')).toBe(
      '<button formaction="#">x</button>',
    );
  });

  it('over-strips a quoted lookalike attribute — accepted, safe direction', () => {
    // The attribute matchers accept a quote prefix (that is what catches
    // `<a title="x"href=…>`), so they also fire on `one=1` inside a quoted
    // value: `<a title="one=1">` loses the value and its closing quote. This
    // over-stripping is deliberate — the regex is not reworked around it — and
    // the test pins the behavior so a rework notices the trade-off.
    expect(sanitizeHtml('<a title="one=1">x</a>')).toBe('<a title=">x</a>');
  });

  it('sees through named character references that hide a URL scheme', () => {
    // `&colon;` decodes before URL parsing, so the scheme test must run on the
    // decoded value; `&Tab;`/`&NewLine;` are stripped by the URL parser itself.
    expect(sanitizeHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="java&Tab;script:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="java&NewLine;script:alert(1)">x</a>')).toBe('<a href="#">x</a>');
    expect(sanitizeHtml('<a href="javascript&#58;alert(1)">x</a>')).toBe('<a href="#">x</a>');
  });

  it('decodes entity layers to a fixpoint, and both numeric prefixes', () => {
    // Five nested `&amp;` layers need six passes; a capped loop leaves the
    // innermost layer for the browser (or the next save) to peel off.
    const nested = (depth: number) =>
      `<a href="javascript&${'amp;'.repeat(depth)}colon;alert(1)">x</a>`;
    for (let depth = 1; depth <= 8; depth += 1) {
      expect(sanitizeHtml(nested(depth)), `depth ${depth}`).toBe('<a href="#">x</a>');
    }
    expect(sanitizeHtml('<a href="&amp;colon;">x</a>')).toBe('<a href=":">x</a>');
    expect(sanitizeHtml('<a href="&amp;amp;amp;#106;avascript:alert(1)">x</a>')).toBe(
      '<a href="#">x</a>',
    );
    // `&#X6a;` is as valid to the browser as `&#x6a;`.
    expect(sanitizeHtml('<a href="&#X6a;avascript:alert(1)">x</a>')).toBe('<a href="#">x</a>');
  });

  it('catches entity-encoded payloads', () => {
    expect(sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('');
    expect(sanitizeHtml('<img src="x" onerror=&#97;&#108;&#101;&#114;&#116;(1)>')).toBe(
      '<img src="x" >',
    );
  });
});
