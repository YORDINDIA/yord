import { NextResponse } from 'next/server';

// Shared cost guard for admin AI routes (listing, marketing, blog, image).
// In-memory and best-effort (resets on redeploy); promotes to Upstash/DB
// counters if abuse persists. Adoption: call assertAiAllowed(userId) at the
// top of each POST handler before invoking OpenAI.
//
//   const denied = assertAiAllowed(user.id);
//   if (denied) return denied;

const MAX_CALLS_PER_MINUTE = 10;
const MAX_CALLS_PER_DAY = 200;

const minuteBuckets = new Map<string, number[]>();
const dayBuckets = new Map<string, number[]>();

// Bound memory like the storefront rate limiter: evict the oldest key (Map
// preserves insertion order) once the table grows past this many users.
const MAX_USERS = 10_000;

function setBucket(bucket: Map<string, number[]>, key: string, hits: number[]) {
  if (!bucket.has(key) && bucket.size >= MAX_USERS) {
    const oldest = bucket.keys().next().value;
    if (oldest !== undefined) bucket.delete(oldest);
  }
  // Refresh recency so hot users are not the eviction victim.
  if (bucket.has(key)) bucket.delete(key);
  bucket.set(key, hits);
}

function hit(bucket: Map<string, number[]>, key: string, windowMs: number): number {
  const now = Date.now();
  const hits = (bucket.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  setBucket(bucket, key, hits);
  return hits.length;
}

export function assertAiAllowed(userId: string): NextResponse | null {
  const perMinute = hit(minuteBuckets, userId, 60 * 1000);
  if (perMinute > MAX_CALLS_PER_MINUTE) {
    return NextResponse.json(
      { error: 'AI rate limit exceeded. Wait a minute and retry.' },
      { status: 429 }
    );
  }
  const perDay = hit(dayBuckets, userId, 24 * 60 * 60 * 1000);
  if (perDay > MAX_CALLS_PER_DAY) {
    return NextResponse.json(
      { error: 'Daily AI budget exhausted. Resets at midnight UTC.' },
      { status: 429 }
    );
  }
  return null;
}

export const AI_GUARD_LIMITS = { MAX_CALLS_PER_MINUTE, MAX_CALLS_PER_DAY };
