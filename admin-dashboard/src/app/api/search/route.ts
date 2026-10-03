export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { emptySearchResults, searchAll } from '@/lib/data/search';
import { requireAdmin } from '@/lib/utils/admin';

/**
 * Global search for the command palette.
 *
 * Admin-gated like every other API route (middleware matches `/api/:path*`
 * too, so an unauthenticated call gets 401 rather than a redirect). A term
 * shorter than two characters returns the empty shape instead of an error:
 * the palette sends nothing below that threshold, and "keep typing" is not a
 * failure the UI should have to render.
 */

const MIN_QUERY_LENGTH = 2;

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    const q = new URL(req.url).searchParams.get('q') ?? '';
    if (q.trim().length < MIN_QUERY_LENGTH) {
      return NextResponse.json(emptySearchResults());
    }

    return NextResponse.json(await searchAll(q));
  } catch (error) {
    // PostgREST messages can name tables and policies: log them, never return them.
    console.error('Admin search failed', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
