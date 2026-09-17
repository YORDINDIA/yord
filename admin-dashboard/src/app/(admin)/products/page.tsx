import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils/format';
import { revalidatePath } from 'next/cache';
import { PackageX } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ExportCsvButton from '@/components/products/ExportCsvButton';

const PAGE_SIZE = 25;
const STATUSES = ['all', 'active', 'draft', 'archived'] as const;

async function bulkUpdateStatus(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const ids = formData
    .getAll('ids')
    .flatMap((v) => String(v).split(','))
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const status = String(formData.get('bulk_status') || '').trim();
  if (ids.length === 0 || !['active', 'draft', 'archived'].includes(status)) return;
  await supabase.from('products').update({ status, updated_at: new Date().toISOString() }).in('id', ids);
  revalidatePath('/products');
}

type Search = { q?: string; status?: string; stock?: string; sort?: string; page?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await createServerClient();
  const resolved = await searchParams;
  const query = resolved?.q?.trim() || '';
  const status = STATUSES.includes(resolved?.status as (typeof STATUSES)[number]) ? resolved.status! : 'all';
  const stockFilter = resolved?.stock === 'low' ? 'low' : 'all';
  const sort = resolved?.sort === 'title' ? 'title' : 'updated_at';
  const page = Math.max(1, Number(resolved?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Low-stock filtering runs server-side so the count and pager stay in sync
  // with what is displayed (filtering after pagination showed empty pages).
  let lowStockIds: number[] | null = null;
  if (stockFilter === 'low') {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('product_id')
      .or('inventory_quantity.lte.5,inventory_quantity.is.null')
      .limit(500);
    lowStockIds = [
      ...new Set((variants || []).map((v) => v.product_id).filter((id): id is number => id != null)),
    ];
  }

  let request = supabase
    .from('products')
    .select('id, title, status, tags, updated_at, product_variants(price, inventory_quantity), product_images(supabase_url)', { count: 'exact' })
    .order(sort, { ascending: sort === 'title' });

  if (status !== 'all') request = request.eq('status', status);
  if (query) {
    const safe = query.replace(/[%(),"]/g, '').trim().slice(0, 100);
    if (safe) request = request.or(`title.ilike.%${safe}%,handle.ilike.%${safe}%,tags.ilike.%${safe}%`);
  }
  // -1 never matches a bigint id, so the empty low-stock case still queries.
  if (lowStockIds) request = request.in('id', lowStockIds.length > 0 ? lowStockIds : [-1]);
  request = request.range(from, to);

  const { data: products, count } = await request;
  const visible = (products || []).map((p) => ({
    ...p,
    inventory: p.product_variants?.[0]?.inventory_quantity ?? 0,
  }));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const csvRows = visible.map((p) => ({
    id: p.id,
    title: p.title || '',
    status: p.status || '',
    price: p.product_variants?.[0]?.price ?? 0,
    inventory: p.inventory,
  }));

  function qs(next: Partial<Record<keyof Search, string | number>>): string {
    const params = new URLSearchParams({
      q: query,
      status,
      stock: stockFilter,
      sort,
      page: String(page),
      ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, String(v)])),
    });
    return `/products?${params.toString()}`;
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Catalog</div>
          <div className="helper">{count ?? 0} products · page {page} of {totalPages}</div>
        </div>
        <div className="toolbar">
          <ExportCsvButton rows={csvRows} />
          <Link className="button primary" href="/products/new">New Product</Link>
        </div>
      </div>

      <form className="toolbar" style={{ marginBottom: 16 }}>
        <input className="input" name="q" placeholder="Search products" defaultValue={query} />
        <select className="select" name="status" defaultValue={status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <select className="select" name="stock" defaultValue={stockFilter}>
          <option value="all">All stock</option>
          <option value="low">Low stock (≤ 5)</option>
        </select>
        <select className="select" name="sort" defaultValue={sort}>
          <option value="updated_at">Recently updated</option>
          <option value="title">Title A–Z</option>
        </select>
        <button className="button" type="submit">Apply</button>
      </form>

      {visible.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          hint="Clear search or change status/stock filters."
          icon={<PackageX size={28} />}
        />
      ) : (
        <form action={bulkUpdateStatus}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th><span className="helper">Select</span></th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Inventory</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const price = product.product_variants?.[0]?.price ?? 0;
                  return (
                    <tr key={product.id}>
                      <td><input type="checkbox" name="ids" value={product.id} aria-label={`Select ${product.title}`} /></td>
                      <td>
                        <Link href={`/products/${product.id}`}>{product.title}</Link>
                        <div className="helper">{product.tags || '-'}</div>
                      </td>
                      <td><StatusBadge value={product.status} /></td>
                      <td>₹{price}</td>
                      <td><StatusBadge value={product.inventory <= 0 ? 'out' : product.inventory <= 5 ? 'low' : 'ok'} label={String(product.inventory)} /></td>
                      <td>{formatDate(product.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <span className="helper">Bulk: tick rows, then pick a status.</span>
            <select className="select" name="bulk_status" defaultValue="active">
              <option value="active">Publish (active)</option>
              <option value="draft">Move to draft</option>
              <option value="archived">Archive</option>
            </select>
            <button className="button" type="submit">Apply to selected</button>
          </div>
        </form>
      )}

      <div className="pagination">
        <span className="helper">Showing {visible.length} of {count ?? 0}</span>
        <div className="toolbar">
          {page > 1 && <Link className="button" href={qs({ page: page - 1 })}>Previous</Link>}
          {page < totalPages && <Link className="button" href={qs({ page: page + 1 })}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
