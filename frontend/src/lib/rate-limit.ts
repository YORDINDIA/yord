import { NextResponse } from 'next/server';

// Best-effort in-memory rate limit for low-volume public forms.
// (Resets on redeploy; use Redis/Upstash if abuse persists.)
const buckets = new Map<string, number[]>();

// Bound memory: evict the oldest key (Map preserves insertion order,
// i.e. LRU-ish) once the table grows past this many distinct keys.
const MAX_BUCKETS = 10_000;

function setBucket(key: string, hits: number[]) {
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }
  // Refresh recency so hot keys are not the eviction victim.
  if (buckets.has(key)) buckets.delete(key);
  buckets.set(key, hits);
}

export function isRateLimited(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    setBucket(key, hits);
    return true;
  }
  hits.push(now);
  setBucket(key, hits);
  return false;
}

/**
 * Client IP for rate-limit keys. `x-nf-client-connection-ip` is Netlify's
 * authoritative peer address and cannot be set by the client, so it wins.
 * `x-forwarded-for` is client-spoofable and is only a fallback for other
 * hosts/local dev — and then its LAST entry is used, because a proxy appends
 * the address it saw; the first entry is whatever the client sent.
 *
 * `cf-connecting-ip` would be authoritative on Cloudflare Workers, but it is
 * client-supplied on the Netlify fallback path, so it is deliberately not
 * trusted while both hosts are live; XFF-last (which Cloudflare appends) is
 * the Workers-safe fallback. `x-real-ip` is not read: no host here sets it,
 * so any value in it came from the client.
 *
 * Takes anything with a `.headers.get()` — a `NextRequest`, or `{ headers }`
 * wrapping `await headers()` from next/headers (server actions).
 */
export function clientIp(request: { headers: { get(name: string): string | null } }): string {
  const forwardedFor = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .pop();
  return (
    request.headers.get('x-nf-client-connection-ip')?.trim() ||
    forwardedFor ||
    'unknown'
  );
}

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
