import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyticsBatchSchema } from '@/lib/analytics/eventsSchema';
import { eventsToRows } from '@/lib/analytics/rows';
import { logWarn } from '@/lib/logger';
import { isRateLimited, clientIp, rateLimitResponse } from '@/lib/rate-limit';

// Behavioral analytics ingest. The storefront collector batches events and
// posts them here; validation lives in the shared zod schema so the client
// and this route cannot drift apart.

export async function POST(request: NextRequest) {
  // Generous for a real session (a browse fires a handful of events), tight
  // enough that a script cannot write the table at any rate.
  if (isRateLimited(`analytics:${clientIp(request)}`, 120, 60 * 1000)) {
    return rateLimitResponse();
  }

  // Analytics is optional infrastructure: an unconfigured backend degrades to
  // a quiet no-op so the collector never surfaces errors in the UI.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = analyticsBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid events' }, { status: 400 });
  }

  // Service client: analytics_events has RLS with no policies, so only the
  // service role writes it (the route is the only ingest path).
  const supabase = createClient(url, secretKey);
  const { error } = await supabase
    .from('analytics_events')
    .insert(eventsToRows(parsed.data.events));

  if (error) {
    logWarn('analytics/events', 'INSERT_FAILED', String(error.message).slice(0, 200));
    return NextResponse.json({ error: 'Could not record events' }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
