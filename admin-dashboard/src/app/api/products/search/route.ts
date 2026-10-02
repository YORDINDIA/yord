import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/utils/admin';
import { listProductPickerRows, searchProductsForPicker } from '@/lib/data/products';
import { productIdsSchema, productPickerQuerySchema } from '@/lib/validation';

export const runtime = 'nodejs';

/**
 * Product lookup for the collection editor's picker.
 *
 * The old editor asked the admin to type comma-separated bigint ids into a text
 * box — unusable with 463 products and impossible to verify. This serves the
 * two reads the picker needs:
 *
 *   GET /api/products/search?q=coldplay&page=2&pageSize=20
 *     → paged search over title/handle/tags, same query as the catalog table
 *   GET /api/products/search?ids=8900000001,8900000004
 *     → light rows for an explicit id list, in the submitted order, so a
 *       re-opened collection shows real titles for its current members
 *
 * Admin-only (`requireAdmin` returns a 401/403 NextResponse rather than
 * throwing), and both branches validate their params with the shared schemas.
 *
 * Deliberately NOT rate-limited, matching every other admin API route: there is
 * no limiter anywhere in this app, and inventing one for this route would be a
 * new pattern with no threat model behind it. The caller is an authenticated
 * admin (the middleware and the layout both gate the whole `(admin)` tree), the
 * only client is the picker's 250 ms-debounced, abortable search, and the worst
 * case is an admin issuing many reads against their own dashboard — the same
 * access they have through the products table. Revisit if an unauthenticated or
 * public admin endpoint is ever added.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const params = new URL(req.url).searchParams;

  const rawIds = params.get('ids');
  if (rawIds) {
    // Reuse the collection form's id parser: same accepted format, same
    // drop-invalid-entries behaviour, so the picker's round-trip cannot differ
    // from what the save action will parse.
    const ids = productIdsSchema.parse(rawIds);
    if (ids.length === 0) return NextResponse.json({ rows: [], count: 0 });
    const rows = await listProductPickerRows(ids);
    return NextResponse.json({ rows, count: rows.length });
  }

  const parsed = productPickerQuerySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }
  const { rows, count, page, pageSize } = await searchProductsForPicker({
    q: parsed.data.q,
    status: parsed.data.status === 'all' ? undefined : parsed.data.status,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });
  return NextResponse.json({ rows, count, page, pageSize });
}
