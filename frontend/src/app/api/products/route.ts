import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getProductsFiltered,
  getProductsByCollectionHandle,
} from '@/lib/supabase/queries';
import { isSupabaseUnconfigured } from '@/lib/result';
import { logDbError } from '@/lib/logger';
import { isRateLimited, clientIp } from '@/lib/rate-limit';

const QuerySchema = z.object({
  // filter mode: vendor/type search; collection mode: collects two-hop by
  // collection handle; artist mode: same two-hop, no published gate.
  mode: z.enum(['filter', 'collection', 'artist']).default('filter'),
  handle: z.string().min(1).max(200).optional(),
  artist: z.string().max(200).optional(),
  type: z.string().max(200).optional(),
  // No `.default('newest')`: absent means "the shopper passed no `?sort=`", and
  // only the query helper knows whether that should fall back to a collection's
  // own `sort_order`. Defaulting here would silently override it on pages 2+.
  // `manual` is accepted because a collection whose default order is Manual
  // seeds the grid with it — page 2+ must request the same order back. It is
  // not in the shopper sort dropdown; it is just not *secret* either.
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'title', 'manual']).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(20),
});

/**
 * Paged catalog reads for infinite scroll (pages 2+; page 1 is SSR'd).
 * One server implementation — the same helpers the pages use — so client
 * pages carry identical fields to SSR page 1. Unknown handle → 404;
 * unconfigured backend → 503 (client shows retry); failure → 500.
 */
export async function GET(request: NextRequest) {
  if (isRateLimited(`products:${clientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (isSupabaseUnconfigured()) {
    return NextResponse.json({ error: 'Catalog unavailable' }, { status: 503 });
  }

  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const q = parsed.data;

  try {
    // Public catalog reads (RLS applies); no service key. The query helpers
    // below construct their own server/static clients.
    if (q.mode === 'filter') {
      const { data, count } = await getProductsFiltered({
        artist: q.artist,
        productType: q.type,
        page: q.page,
        pageSize: q.pageSize,
        sortBy: q.sort,
      });
      return NextResponse.json({ data, count, page: q.page, pageSize: q.pageSize });
    }

    if (!q.handle) {
      return NextResponse.json({ error: 'Missing handle' }, { status: 400 });
    }
    const result = await getProductsByCollectionHandle(
      q.handle,
      { sort: q.sort, page: q.page, pageSize: q.pageSize },
      { publishedOnly: q.mode === 'collection', useStatic: true },
    );
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ...result, page: q.page, pageSize: q.pageSize });
  } catch (error) {
    logDbError('api:products', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
