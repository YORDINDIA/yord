import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import DataTable, { type DataTableColumn } from '@/components/data/DataTable';
import OrderStatusForm from '@/components/orders/OrderStatusForm';
import FulfillmentForm from '@/components/orders/FulfillmentForm';
import StatusBadge from '@/components/ui/StatusBadge';
import RefundPanel from '../refund-panel';
import { getOrder } from '@/lib/data/orders';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { LineItem, Transaction } from '@yord/db-types';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  // Lossless ID handling: `Number()` rounds BIGINTs above 2^53, so the raw
  // decimal string is validated and passed straight through to the lookup
  // (PostgREST binds it as bigint). Anything non-numeric is a 404.
  if (!/^\d+$/.test(id) || !/[1-9]/.test(id)) {
    return { title: 'Order · YORD Admin' };
  }
  const detail = await getOrder(id).catch(() => null);
  return { title: detail ? `${detail.order.name ?? `Order ${id}`} · YORD Admin` : 'Order · YORD Admin' };
}

/**
 * Order detail.
 *
 * Four sequential queries (order, then line items, transactions, fulfillments)
 * became one `getOrder()` that runs the three child reads in parallel. The two
 * inline mutations — which `return`ed on any database error, so a rejected save
 * was indistinguishable from a successful one — are now bound to the actions in
 * `src/server/actions/orders.ts`.
 */
export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  // Same lossless rule as generateMetadata: never round the route param
  // through `Number()` (`Number.isInteger` still accepts the rounded value,
  // so a huge BIGINT could load a different order). Decimal strings go to
  // PostgREST verbatim; anything else is notFound().
  if (!/^\d+$/.test(id) || !/[1-9]/.test(id)) notFound();

  const detail = await getOrder(id);
  if (!detail) notFound();

  const { order, lineItems, transactions, fulfillments } = detail;
  const currency = order.currency || 'INR';

  const placed = Boolean(order.created_at);
  const paid =
    order.financial_status === 'paid' || order.financial_status === 'partially_refunded';
  const fulfilled = order.fulfillment_status === 'fulfilled';
  const refunded =
    order.financial_status === 'refunded' || order.financial_status === 'partially_refunded';
  const steps = [
    { label: 'Placed', done: placed },
    { label: 'Paid', done: paid },
    { label: 'Fulfilled', done: fulfilled },
    { label: 'Refunded', done: refunded },
  ];

  const lineItemColumns: DataTableColumn<LineItem>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (item) =>
        item.product_id ? (
          <Link href={`/products/${item.product_id}`}>{item.title}</Link>
        ) : (
          item.title
        ),
    },
    {
      key: 'variant',
      header: 'Variant / SKU',
      render: (item) => (
        <span className="helper">
          {item.variant_title || '—'} · {item.sku || 'no SKU'}
        </span>
      ),
      hideOnTablet: true,
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: (item) => String(item.quantity ?? 0),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (item) => formatCurrency(item.price, currency),
    },
  ];

  const transactionColumns: DataTableColumn<Transaction>[] = [
    { key: 'gateway', header: 'Gateway', render: (txn) => txn.gateway || '—' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (txn) => formatCurrency(txn.amount, txn.currency || currency),
    },
    { key: 'status', header: 'Status', render: (txn) => <StatusBadge value={txn.status} /> },
    {
      key: 'payment',
      header: 'Payment Id',
      render: (txn) => txn.payment_id || '—',
      hideOnMobile: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Order {order.name}</div>
            <div className="helper">Created {formatDate(order.created_at)}</div>
          </div>
          <Link className="button" href="/orders">
            Back
          </Link>
        </div>
        <div className="timeline" style={{ marginBottom: 16 }}>
          {steps.map((step) => (
            <span key={step.label} className={`timeline-step${step.done ? ' done' : ''}`}>
              <span className="timeline-dot" />
              {step.label}
            </span>
          ))}
        </div>
        <div className="form-grid">
          <div>
            <span className="helper">Total</span>
            <div>{formatCurrency(order.total_price, currency)}</div>
          </div>
          <div>
            <span className="helper">Customer Email</span>
            <div>{order.email || '—'}</div>
          </div>
          <div>
            <span className="helper">Financial</span>
            <div>
              <StatusBadge value={order.financial_status} />
            </div>
          </div>
          <div>
            <span className="helper">Fulfillment</span>
            <div>
              <StatusBadge value={order.fulfillment_status} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="section-title">Line Items</div>
        </div>
        <DataTable
          caption="Line items"
          columns={lineItemColumns}
          rows={lineItems}
          rowKey={(item) => item.id}
          emptyTitle="No line items"
          emptyHint="This order has no recorded items."
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Statuses</div>
            <div className="helper">Constrained to valid Shopify-style states.</div>
          </div>
        </div>
        <OrderStatusForm
          orderId={id}
          financialStatus={order.financial_status}
          fulfillmentStatus={order.fulfillment_status}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Fulfillment</div>
            <div className="helper">Tracking number required. History newest first.</div>
          </div>
        </div>
        <FulfillmentForm orderId={id} fulfillments={fulfillments} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Transactions</div>
            <div className="helper">Refunds are processed via Razorpay.</div>
          </div>
        </div>
        <DataTable
          caption="Transactions"
          columns={transactionColumns}
          rows={transactions}
          rowKey={(txn) => txn.id}
          emptyTitle="No transactions"
          emptyHint="Nothing has been charged against this order."
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="section-title">Refunds</div>
            <div className="helper">Button disables when nothing is refundable.</div>
          </div>
        </div>
        <RefundPanel orderId={id} transactions={transactions} />
      </div>
    </div>
  );
}
