import Link from 'next/link';
import type { Metadata } from 'next';
import ExportCsvButton from '@/components/products/ExportCsvButton';
import { listProducts } from '@/lib/data/products';
import { firstParam, pageCount } from '@/lib/pagination';
import ProductsClient from './products-client';

export const metadata: Metadata = { title: 'Products · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Catalog list.
 *
 * A thin server component: all reads go through `src/lib/data`, all rendering
 * through the shared table components. The page contains no `.from()` call, no
 * `PAGE_SIZE`, no `qs()`, and no hand-rolled search sanitizer — those were
 * duplicated here and in orders/customers/inventory.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    status: firstParam(resolved.status),
    stock: firstParam(resolved.stock),
    sort: firstParam(resolved.sort),
  };

  const { rows, count, page, pageSize } = await listProducts({
    q: params.q,
    status: params.status,
    stock: params.stock === 'low' ? 'low' : 'all',
    sort: params.sort === 'title' ? 'title' : 'updated_at',
    page: Number(firstParam(resolved.page)) || 1,
  });

  const csvRows = rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status ?? '',
    price: row.price,
    inventory: row.inventory,
  }));

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Catalog</div>
          <div className="helper">
            {count} products · page {page} of {pageCount(count, pageSize)}
          </div>
        </div>
        <div className="toolbar">
          <ExportCsvButton rows={csvRows} />
          <Link className="button primary" href="/products/new">
            New Product
          </Link>
        </div>
      </div>

      <ProductsClient
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        params={params}
      />
    </div>
  );
}
