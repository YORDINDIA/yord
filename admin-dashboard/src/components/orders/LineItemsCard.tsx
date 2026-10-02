import Link from 'next/link';
import { Package } from 'lucide-react';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import Thumb from '@/components/ui/Thumb';
import { formatCount, itemCountLabel, lineSubtotal, lineTotal } from './format';
import type { OrderLineItem } from '@/lib/data/orders';
import { formatCurrency, formatDate } from '@/lib/utils/format';

/**
 * What the order was for, at the price it was charged.
 *
 * The cover comes from `OrderDetail.lineItems[].imageUrl`, which `getOrder`
 * batch-reads from `coversForProducts` — one query for the whole order, not one
 * per row. A product that no longer exists falls back to `Thumb`'s placeholder,
 * because the line item's price and SKU are still the record of the sale.
 */
export default function LineItemsCard({
  lineItems,
  currency,
  closedAt,
}: {
  lineItems: OrderLineItem[];
  currency: string;
  closedAt: string | null;
}) {
  const units = lineItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const itemsSubtotal = lineItems.reduce((sum, item) => sum + lineSubtotal(item), 0);

  const columns: DataTableColumn<OrderLineItem>[] = [
    {
      key: 'title',
      header: 'Item',
      render: (item) => (
        <>
          <span className="cell-title">
            {item.product_id ? (
              <Link href={`/products/${item.product_id}`}>{item.title}</Link>
            ) : (
              item.title
            )}
          </span>
          <div className="cell-sub">{item.variant_title || 'no variant'}</div>
        </>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      hideOnTablet: true,
      render: (item) => <span className="mono">{item.sku || '—'}</span>,
    },
    {
      key: 'unit',
      header: 'Unit price',
      align: 'right',
      render: (item) => <span className="table-num">{formatCurrency(item.price, currency)}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: (item) => <span className="table-num">{formatCount(Number(item.quantity ?? 0))}</span>,
    },
    {
      key: 'total',
      header: 'Line total',
      align: 'right',
      render: (item) => (
        <>
          <span className="table-num">{formatCurrency(lineTotal(item), currency)}</span>
          {Number(item.total_discount ?? 0) > 0 && (
            <div className="cell-sub">
              −{formatCurrency(Number(item.total_discount), currency)} discount
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Line items</div>
          <div className="helper">
            {itemCountLabel(lineItems.length, units)} · {formatCurrency(itemsSubtotal, currency)}{' '}
            before discounts
          </div>
        </div>
        {closedAt && <span className="helper">Closed {formatDate(closedAt)}</span>}
      </div>
      <DataTable
        caption="Line items"
        columns={columns}
        rows={lineItems}
        rowKey={(item) => item.id}
        leading={(item) => (
          <Thumb size="sm" src={item.imageUrl} alt={item.title} fallbackIcon={Package} />
        )}
        emptyTitle="No line items on this order"
        emptyHint="The order was recorded without items — imported orders occasionally arrive this way."
        emptyIcon={<Package size={26} aria-hidden />}
      />
    </div>
  );
}
