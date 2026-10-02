import Link from 'next/link';
import type { Metadata } from 'next';
import { Archive, CheckCircle2, FileEdit, Package, Plus, TriangleAlert } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import ExportCsvButton from '@/components/products/ExportCsvButton';
import { getProductStats, listProducts } from '@/lib/data/products';
import { LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { firstParam } from '@/lib/pagination';
import ProductsClient from './products-client';

export const metadata: Metadata = { title: 'Products · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Catalog list.
 *
 * A thin server component: the reads go through `src/lib/data`, the rendering
 * through the shared table components and `ProductsClient`. The page contains
 * no `.from()` call, no `PAGE_SIZE`, and no hand-rolled search sanitizer — those
 * lived here (and in orders/customers/inventory) before the data layer.
 *
 * The stat strip comes from `getProductStats()`: five head-only counts, so the
 * numbers describe the whole catalog rather than the filtered page.
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

  const [{ rows, count, page, pageSize }, stats] = await Promise.all([
    listProducts({
      q: params.q,
      status: params.status,
      stock: params.stock === 'low' ? 'low' : 'all',
      sort: params.sort === 'title' ? 'title' : 'updated_at',
      page: Number(firstParam(resolved.page)) || 1,
    }),
    getProductStats(),
  ]);

  const csvRows = rows.map((row) => ({
    id: row.id,
    title: row.title,
    handle: row.handle ?? '',
    status: row.status ?? '',
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? '',
    totalInventory: row.totalInventory,
    variants: row.variantCount,
  }));

  return (
    <>
      <PageHeader
        icon={Package}
        tone="indigo"
        title="Products"
        description="Catalog, pricing, and stock."
        actions={
          <>
            <ExportCsvButton rows={csvRows} />
            <Link className="button primary" href="/products/new">
              <Plus size={14} aria-hidden />
              New product
            </Link>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Products"
          value={stats.total}
          icon={Package}
          tone="indigo"
          hint="Every status"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          tone="emerald"
          hint="Live on the storefront"
          href="/products?status=active"
        />
        <StatCard
          label="Draft"
          value={stats.draft}
          icon={FileEdit}
          tone="amber"
          hint="Not published"
          href="/products?status=draft"
        />
        <StatCard
          label="Archived"
          value={stats.archived}
          icon={Archive}
          tone="slate"
          hint="Hidden from the storefront"
          href="/products?status=archived"
        />
        <StatCard
          label="Low-stock variants"
          value={stats.lowStock}
          icon={TriangleAlert}
          tone="rose"
          hint={`≤ ${LOW_STOCK_THRESHOLD} units`}
          href="/products?stock=low"
          valueSm
        />
      </div>

      <div className="card">
        <ProductsClient
          rows={rows}
          count={count}
          page={page}
          pageSize={pageSize}
          params={params}
        />
      </div>
    </>
  );
}
