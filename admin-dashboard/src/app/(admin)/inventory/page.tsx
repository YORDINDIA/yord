import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Boxes,
  CircleHelp,
  CircleSlash,
  IndianRupee,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';
import type { Location } from '@yord/db-types';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import InventoryTable from '@/components/inventory/InventoryTable';
import { LOW_STOCK_THRESHOLD, isOneOf } from '@/lib/constants';
import {
  INVENTORY_SORTS,
  INVENTORY_STOCKS,
  getInventoryStats,
  listInventory,
  listLocations,
} from '@/lib/data/inventory';
import { firstParam, qs } from '@/lib/pagination';
import { formatCurrency } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Inventory · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Inventory overview.
 *
 * The stock view is the page: a header with the stock filters as tabs, a strip
 * of the five numbers that decide what to do next (each linking to the filter
 * that lists it), then one dense table of variants whose quantity is editable in
 * place. The old page rendered a 71px row — the inline stepper wrapped — and had
 * no stock signal above the list.
 *
 * `?tab=locations` is kept working (the header links to it): it is a different
 * entity, so it is a separate view rather than a fourth filter tab.
 *
 * The old page also fetched `.limit(100)` variants and paginated nothing, so the
 * 101st variant could never be found or adjusted from here; the list now pages
 * through `listInventory()` with the stock filter applied before the range.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;

  if (firstParam(resolved.tab) === 'locations') {
    return <LocationsView />;
  }

  const rawStock = firstParam(resolved.stock);
  const rawSort = firstParam(resolved.sort);
  const stock = isOneOf(INVENTORY_STOCKS, rawStock) ? rawStock : undefined;
  const sort = isOneOf(INVENTORY_SORTS, rawSort) ? rawSort : undefined;
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
    stock,
    sort,
  };

  const [{ rows, count, page, pageSize }, stats] = await Promise.all([
    listInventory({
      q: params.q,
      stock,
      sort,
      page: Number(firstParam(resolved.page)) || 1,
    }),
    getInventoryStats(),
  ]);

  // Tab hrefs go through `qs`, so switching stock keeps the search and the sort
  // and drops `page` (a page-4 low-stock list has no page 4 of out-of-stock).
  const tabs = [
    {
      key: 'all',
      label: 'All',
      href: qs('/inventory', params, { stock: undefined, page: undefined }),
      icon: Boxes,
      count: stats.total,
    },
    {
      key: 'low',
      label: 'Low stock',
      href: qs('/inventory', params, { stock: 'low', page: undefined }),
      icon: TriangleAlert,
      count: stats.low,
    },
    {
      key: 'out',
      label: 'Out of stock',
      href: qs('/inventory', params, { stock: 'out', page: undefined }),
      icon: CircleSlash,
      count: stats.out,
    },
  ];

  return (
    <>
      <PageHeader
        icon={Boxes}
        tone="emerald"
        title="Inventory"
        description="Stock levels, adjustments, and reorder signals."
        actions={
          <Link className="button" href="/inventory?tab=locations">
            <Warehouse size={14} aria-hidden />
            Locations
          </Link>
        }
        tabs={<Tabs items={tabs} active={stock ?? 'all'} ariaLabel="Stock filters" />}
      />

      <div className="stat-grid">
        <StatCard
          label="Variants tracked"
          value={stats.total}
          icon={Boxes}
          tone="emerald"
          hint={`${stats.healthy} above the reorder threshold`}
          href="/inventory"
        />
        <StatCard
          label="Out of stock"
          value={stats.out}
          icon={CircleSlash}
          tone="rose"
          hint="Quantity at or below zero"
          href="/inventory?stock=out"
        />
        <StatCard
          label="Low stock"
          value={stats.low}
          icon={TriangleAlert}
          tone="amber"
          hint={`≤ ${LOW_STOCK_THRESHOLD} units left`}
          href="/inventory?stock=low"
        />
        <StatCard
          label="Inventory value"
          value={formatCurrency(stats.value)}
          valueSm
          icon={IndianRupee}
          tone="emerald"
          hint="Quantity × price, tracked variants"
        />
        <StatCard
          label="Untracked"
          value={stats.untracked}
          icon={CircleHelp}
          tone="slate"
          hint="Quantity never counted"
          href="/inventory?stock=untracked"
        />
      </div>

      <div className="card">
        <InventoryTable
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

/**
 * Fulfillment/stock points, reached from the header's Locations button.
 *
 * A separate view rather than a tab: the tabs are stock filters over one table,
 * and this is a different entity. `listLocations()` stays unpaged — it is a
 * handful of rows.
 */
async function LocationsView() {
  const locations = await listLocations();

  const columns: DataTableColumn<Location>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'city', header: 'City', render: (row) => row.city || '—' },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <StatusBadge
          value={row.active ? 'yes' : 'no'}
          label={row.active ? 'Active' : 'Inactive'}
          dot
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Warehouse}
        tone="emerald"
        title="Inventory locations"
        description="Fulfillment and stock points."
        actions={
          <Link className="button" href="/inventory">
            <Boxes size={14} aria-hidden />
            Back to stock
          </Link>
        }
      />
      <div className="card">
        <DataTable
          caption="Locations"
          columns={columns}
          rows={locations}
          rowKey={(row) => row.id}
          emptyTitle="No locations"
          emptyHint="Add fulfillment locations to track stock points."
          emptyIcon={<Warehouse size={28} />}
        />
      </div>
    </>
  );
}
