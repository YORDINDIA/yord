import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mail, Receipt } from 'lucide-react';
import CopyButton from '@/components/orders/CopyButton';
import CustomerCard from '@/components/orders/CustomerCard';
import FulfillmentCard from '@/components/orders/FulfillmentCard';
import LineItemsCard from '@/components/orders/LineItemsCard';
import OrderDetailsCard from '@/components/orders/OrderDetailsCard';
import OrderStatusForm from '@/components/orders/OrderStatusForm';
import PaymentSummaryCard from '@/components/orders/PaymentSummaryCard';
import TransactionsCard from '@/components/orders/TransactionsCard';
import { formatDateTime, lineSubtotal, orderRefundTotals, relativeTime } from '@/components/orders/format';
import styles from '@/components/orders/orders.module.css';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { getOrder } from '@/lib/data/orders';
import { formatDate } from '@/lib/utils/format';
import RefundPanel from '../refund-panel';

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
 * `getOrder` reads the order, its children, its covers, and its refund tally in
 * three parallel waves. This route is then composition: a status strip, four
 * cards in the main column (items, money, fulfillment, transactions), and a side
 * rail (customer, order details, statuses, refund). The two writes bind to the
 * actions in `src/server/actions/orders.ts`, and the refund stays on
 * `POST /api/refunds`.
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

  const { order, customer, lineItems, transactions, fulfillments, refunds, refundState } = detail;
  const currency = order.currency || 'INR';
  const orderLabel = order.name ?? `#${id}`;

  // The customer row supplies the display name; the order's own email and phone
  // are the snapshot the receipt went to, so they win when the row is gone.
  const customerName =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || null;
  const customerEmail = order.email || customer?.email || null;
  const customerPhone = order.phone || customer?.phone || null;
  const customerHref =
    order.customer_id !== null && Number.isSafeInteger(order.customer_id)
      ? `/customers/${order.customer_id}`
      : null;

  const itemsSubtotal = lineItems.reduce((sum, item) => sum + lineSubtotal(item), 0);
  const derivedSubtotal = order.subtotal_price === null || order.subtotal_price === undefined;
  const refundTotals = orderRefundTotals(transactions, refundState);

  const latestFulfillment = fulfillments[0];
  const latestRefund = refunds[0];

  return (
    <>
      <PageHeader
        icon={Receipt}
        tone="blue"
        title={orderLabel}
        description={
          customerEmail
            ? `${customerEmail}${customerPhone ? ` · ${customerPhone}` : ''}`
            : 'Guest checkout — no email on file'
        }
        actions={
          <>
            <CopyButton value={id} label="Copy order id" toastMessage="Order id copied." />
            {customerEmail && (
              <a className="button" href={`mailto:${customerEmail}`}>
                <Mail size={13} aria-hidden />
                Email customer
              </a>
            )}
            <Link className="button" href="/orders">
              All orders
            </Link>
          </>
        }
      />

      {/* Status strip: the two states an admin acts on, plus the four dates that
          explain where the order is in its life. */}
      <div className={styles.metaStrip}>
        <StatusBadge size="md" value={order.financial_status} dot />
        <StatusBadge size="md" value={order.fulfillment_status} dot />
        <span className="chip" title={formatDateTime(order.created_at)}>
          Placed {relativeTime(order.created_at)}
        </span>
        {order.processed_at && (
          <span className="chip" title={formatDateTime(order.processed_at)}>
            Paid {relativeTime(order.processed_at)}
          </span>
        )}
        {latestFulfillment?.created_at && (
          <span className="chip" title={formatDateTime(latestFulfillment.created_at)}>
            Shipped {relativeTime(latestFulfillment.created_at)}
          </span>
        )}
        {latestRefund?.created_at && (
          <span className="chip tone tone-rose" title={formatDateTime(latestRefund.created_at)}>
            Refunded {relativeTime(latestRefund.created_at)}
          </span>
        )}
        {order.cancelled_at && (
          <span className="chip tone tone-rose">Cancelled {formatDate(order.cancelled_at)}</span>
        )}
      </div>

      <div className="layout-split">
        <div className="stack">
          <LineItemsCard lineItems={lineItems} currency={currency} closedAt={order.closed_at} />

          <PaymentSummaryCard
            currency={currency}
            subtotal={derivedSubtotal ? itemsSubtotal : Number(order.subtotal_price)}
            derived={derivedSubtotal}
            discounts={Number(order.total_discounts ?? 0)}
            shipping={Number(order.total_shipping_price ?? 0)}
            tax={Number(order.total_tax ?? 0)}
            total={Number(order.total_price ?? 0)}
            refundedPaise={refundTotals.refundedPaise}
            refundablePaise={refundTotals.refundablePaise}
          />

          <FulfillmentCard orderId={id} fulfillments={fulfillments} />

          <TransactionsCard
            transactions={transactions}
            refunds={refunds}
            refundState={refundState}
            currency={currency}
          />
        </div>

        <div className="side-rail">
          <CustomerCard
            name={customerName}
            email={customerEmail}
            phone={customerPhone}
            customerHref={customerHref}
            shipping={detail.shipping}
            billing={detail.billing}
          />

          <OrderDetailsCard order={order} id={id} currency={currency} />

          <div className="card">
            <div className="card-header">
              <div>
                <span className="section-title">Statuses</span>
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
                <span className="section-title">Refund</span>
                <div className="helper">Partial refunds are capped at what is still refundable.</div>
              </div>
            </div>
            <RefundPanel
              orderId={id}
              currency={currency}
              transactions={transactions.map((txn) => ({
                id: txn.id,
                payment_id: txn.payment_id,
                amount: txn.amount,
                currency: txn.currency,
                status: txn.status,
                refundedPaise: refundState[String(txn.id)]?.refundedPaise ?? 0,
                unknownAmount: refundState[String(txn.id)]?.unknownAmount ?? false,
              }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}
