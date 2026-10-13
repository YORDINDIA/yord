import { NextRequest, NextResponse } from 'next/server';
import { createStaticClient } from '@/lib/supabase/server';
import { buildSearchOrFilter } from '@/lib/search';
import { PRODUCT_SELECT } from '@/lib/data/productsByIds';
import { logDbError } from '@/lib/logger';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q') || '';
  const query = rawQuery.trim().slice(0, 100);

  const rawLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (query.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    // Public catalog reads use the anon client (RLS applies); no service key needed.
    // buildSearchOrFilter escapes quotes/wildcards so the filter cannot break.
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'active')
      .or(buildSearchOrFilter(query))
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      logDbError('search', error);
      // A failed read is not "no matches": 502 keeps the search page's error
      // state reachable (it treats any non-ok response as an error), so a
      // Supabase outage cannot render "No products found".
      return NextResponse.json({ error: 'Search unavailable' }, { status: 502 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (error) {
    logDbError('search', error);
    return NextResponse.json({ error: 'Search unavailable' }, { status: 502 });
  }
}
