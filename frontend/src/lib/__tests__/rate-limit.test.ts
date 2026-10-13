// Rate-limit key derivation. `clientIp` decides which header every public
// limit trusts, so a spoofable choice here silently disables all of them
// (contact/newsletter 5/h, analytics 120/min, both checkout routes, track-order).
import { describe, expect, it } from 'vitest';
import { clientIp, isRateLimited } from '@/lib/rate-limit';

// `clientIp` only reads `request.headers`, so a bare `{ headers }` stands in
// for a NextRequest — the same shape a server action builds around
// `await headers()` from next/headers.
function requestWith(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe('clientIp', () => {
  it("prefers Netlify's authoritative header over a client-supplied XFF", () => {
    expect(
      clientIp(
        requestWith({
          'x-nf-client-connection-ip': '203.0.113.9',
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '5.6.7.8',
        })
      )
    ).toBe('203.0.113.9');
    // ...and still uses it when the client sent no XFF at all.
    expect(clientIp(requestWith({ 'x-nf-client-connection-ip': '203.0.113.9' }))).toBe(
      '203.0.113.9'
    );
  });

  it('ignores a client-supplied cf-connecting-ip', () => {
    // Authoritative on Cloudflare Workers, but client-supplied on the Netlify
    // fallback path — trusting it while both hosts are live would let anyone
    // rotate their rate-limit key per request. Guarded so the trust chain is
    // not "fixed" back to cf-connecting-ip by accident.
    expect(
      clientIp(
        requestWith({ 'cf-connecting-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })
      )
    ).toBe('203.0.113.9');
    expect(clientIp(requestWith({ 'cf-connecting-ip': '9.9.9.9' }))).toBe('unknown');
  });

  it('serves a server action through a bare { headers } shape', () => {
    expect(
      clientIp({ headers: new Headers({ 'x-nf-client-connection-ip': '203.0.113.9' }) })
    ).toBe('203.0.113.9');
  });

  it('uses the LAST x-forwarded-for entry when falling back, because proxies append', () => {
    // The first entry is whatever the client sent; the last is what the
    // nearest proxy observed.
    expect(clientIp(requestWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe(
      '203.0.113.9'
    );
    expect(clientIp(requestWith({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    // Whitespace/empty entries are skipped rather than bucketing everyone
    // under a shared key.
    expect(clientIp(requestWith({ 'x-forwarded-for': ' 203.0.113.9 , ' }))).toBe('203.0.113.9');
  });

  it('ignores client-set x-real-ip and falls back to a constant', () => {
    expect(clientIp(requestWith({ 'x-real-ip': '203.0.113.9' }))).toBe('unknown');
    expect(clientIp(requestWith({}))).toBe('unknown');
    expect(clientIp(requestWith({ 'x-forwarded-for': '' }))).toBe('unknown');
  });

  it('derives distinct keys from distinct clients for the same route', () => {
    const route = 'contact';
    const a = `contact:${clientIp(requestWith({ 'x-nf-client-connection-ip': '203.0.113.9' }))}`;
    const b = `contact:${clientIp(requestWith({ 'x-nf-client-connection-ip': '198.51.100.4' }))}`;
    expect(a).not.toBe(b);
    // The sliding window itself is pinned in checkout-gates.test.ts.
    expect(isRateLimited(`${route}:${a}-${Date.now()}`, 5, 60_000)).toBe(false);
  });
});
