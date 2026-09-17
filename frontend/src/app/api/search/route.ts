import { NextRequest, NextResponse } from 'next/server';
import { createStaticClient } from '@/lib/supabase/server';
import { buildSearchOrFilter } from '@/lib/utils';
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
    // buildSearchOrFilter sanitizes user input (escaped quotes/wildcards, 100-char cap).
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
      return NextResponse.json({ products: [] });
    }

    return NextResponse.json({ products: data || [] });
  } catch (error) {
    logDbError('search', error);
    return NextResponse.json({ products: [] });
  }
}
