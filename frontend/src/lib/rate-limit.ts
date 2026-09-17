import { NextRequest, NextResponse } from 'next/server';

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

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
