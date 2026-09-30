import Link from 'next/link';
import type { Metadata } from 'next';
import { Boxes, Warehouse } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import QuantityStepper from '@/components/inventory/QuantityStepper';
import { listInventory, listLocations } from '@/lib/data/inventory';
import { firstParam } from '@/lib/pagination';
import { stockTone } from '@/lib/constants';
import type { InventoryRow } from '@/lib/data/inventory';
import type { Location } from '@yord/db-types';

export const metadata: Metadata = { title: 'Inventory · YORD Admin' };

type Search = Record<string, string | string[] | undefined>;

/**
 * Inventory overview.
 *
 * The stock tab fetched `.limit(100)` variants and paginated nothing, so the
 * 101st variant could never be found or adjusted from this page. The search
 * sanitizer was a fourth private copy of `q.replace(/[%(),"]/g, '')`, applied to
 * a `product.title` column that the `!inner` embed did not actually expose to
 * `.or()` — so searching by product name silently matched nothing.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const resolved = await searchParams;
  const tab = firstParam(resolved.tab) === 'locations' ? 'locations' : 'stock';
  const params: Record<string, string | undefined> = {
    q: firstParam(resolved.q)?.trim() || undefined,
  };

  // Only the stock tab renders the variant list; skip the query on the locations tab.
  const inventory =
    tab === 'stock'
      ? await listInventory({
          q: params.q,
          page: Number(firstParam(resolved.page)) || 1,
        })
      : null;
  const locations = tab === 'locations' ? await listLocations() : [];

  const stockColumns: DataTableColumn<InventoryRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) =>
        row.product ? (
          <Link href={`/products/${row.product.id}`}>{row.product.title}</Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'variant',
      header: 'Variant',
      render: (row) => row.variant.title || 'Default',
      hideOnTablet: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const qty = row.variant.inventory_quantity ?? 0;
        const tone = stockTone(qty);
        return (
          <StatusBadge
            value={tone}
            label={
              tone === 'out'
                ? 'Out of stock'
                : tone === 'low'
                  ? `Low · ${qty}`
                  : `In stock · ${qty}`
            }
          />
        );
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      render: (row) => (
        <QuantityStepper
          variantId={row.variant.id}
          initial={row.variant.inventory_quantity ?? 0}
        />
      ),
    },
  ];

  const locationColumns: DataTableColumn<Location>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'city', header: 'City', render: (row) => row.city || '—' },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <StatusBadge
          value={row.active ? 'yes' : 'no'}
          label={row.active ? 'Active' : 'Inactive'}
        />
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="toolbar" role="tablist" aria-label="Inventory views">
        <Link
          className={`button${tab === 'stock' ? ' primary' : ''}`}
          href="/inventory?tab=stock"
          role="tab"
          aria-selected={tab === 'stock'}
        >
          Stock
        </Link>
        <Link
          className={`button${tab === 'locations' ? ' primary' : ''}`}
          href="/inventory?tab=locations"
          role="tab"
          aria-selected={tab === 'locations'}
        >
          Locations
        </Link>
      </div>

      {inventory ? (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Inventory Overview</div>
              <div className="helper">
                {inventory.count} variant(s) · sorted by lowest stock. Step to adjust, save per
                row.
              </div>
            </div>
          </div>

          <FilterBar>
            <input type="hidden" name="tab" value="stock" />
            <input
              className="input"
              type="search"
              name="q"
              placeholder="Filter by variant title"
              defaultValue={params.q ?? ''}
              aria-label="Filter variants"
            />
          </FilterBar>

          <DataTable
            caption="Inventory"
            columns={stockColumns}
            rows={inventory.rows}
            rowKey={(row) => row.variant.id}
            emptyTitle="No variants match this filter"
            emptyHint="Clear the filter box to see the full catalog."
            emptyIcon={<Boxes size={28} />}
          />

          <Pagination
            basePath="/inventory"
            params={{ ...params, tab }}
            page={inventory.page}
            pageSize={inventory.pageSize}
            total={inventory.count}
            shown={inventory.rows.length}
            label="variants"
          />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="section-title">Locations</div>
              <div className="helper">Fulfillment and stock points.</div>
            </div>
          </div>
          <DataTable
            caption="Locations"
            columns={locationColumns}
            rows={locations}
            rowKey={(row) => row.id}
            emptyTitle="No locations"
            emptyHint="Add fulfillment locations to track stock points."
            emptyIcon={<Warehouse size={28} />}
          />
        </div>
      )}
    </div>
  );
}
