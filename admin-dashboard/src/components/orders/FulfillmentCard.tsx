import { ExternalLink, Truck } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import FulfillmentForm from './FulfillmentForm';
import { formatCount, formatDateTime, relativeTime } from './format';
import styles from './orders.module.css';
import type { OrderFulfillment } from '@/lib/data/orders';

/** Only `http(s)` tracking URLs become links. */
function safeUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

/** Extra AWB numbers Shopify keeps as JSON (`tracking_numbers`). */
function extraTrackingNumbers(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

/**
 * Shipment history plus the form that records the next one.
 *
 * A vertical timeline (`.vtimeline`) rather than the old single line of chipless
 * text: each entry carries its carrier, tracking link, shipment status, and the
 * line items that went out with it. `fulfillment_line_items` is often empty —
 * the migration did not always write it — so the per-item breakdown degrades to
 * a sentence instead of an empty list.
 */
export default function FulfillmentCard({
  orderId,
  fulfillments,
}: {
  orderId: string;
  fulfillments: OrderFulfillment[];
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">Fulfillment</div>
          <div className="helper">Newest first. A tracking number is required to record a shipment.</div>
        </div>
        <span className="helper">
          {fulfillments.length === 0
            ? 'Nothing shipped'
            : `${formatCount(fulfillments.length)} ${fulfillments.length === 1 ? 'shipment' : 'shipments'}`}
        </span>
      </div>

      {fulfillments.length === 0 ? (
        <div className={styles.timelineBlock}>
          <EmptyState
            tone="blue"
            icon={<Truck size={22} aria-hidden />}
            title="No shipments yet"
            hint="Add a tracking number below and the order is marked fulfilled with it."
          />
        </div>
      ) : (
        <div className={`vtimeline ${styles.timelineBlock}`}>
          {fulfillments.map((fulfillment) => {
            const url = safeUrl(fulfillment.tracking_url);
            const extras = extraTrackingNumbers(fulfillment.tracking_numbers);
            return (
              <div key={fulfillment.id} className="vtimeline-item">
                <span className="vtimeline-dot">
                  <Truck size={11} aria-hidden />
                </span>
                <div className="vtimeline-body">
                  <div className="row-between">
                    <span className="vtimeline-title">
                      {fulfillment.tracking_company || 'Carrier not recorded'}
                    </span>
                    <span
                      className="vtimeline-meta"
                      title={formatDateTime(fulfillment.created_at)}
                    >
                      {relativeTime(fulfillment.created_at)}
                    </span>
                  </div>
                  <div className="vtimeline-meta">
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        {fulfillment.tracking_number || 'tracking link'}
                        <ExternalLink size={11} aria-hidden style={{ marginLeft: 4 }} />
                      </a>
                    ) : (
                      (fulfillment.tracking_number ?? 'no tracking number')
                    )}
                    {fulfillment.shipment_status ? ` · ${fulfillment.shipment_status}` : ''}
                    {fulfillment.status ? ` · ${fulfillment.status}` : ''}
                    {extras.length > 0 ? ` · also ${extras.join(', ')}` : ''}
                  </div>
                  {fulfillment.items.length === 0 ? (
                    <div className="helper">
                      No per-item breakdown recorded for this shipment.
                    </div>
                  ) : (
                    <ul className={styles.itemList}>
                      {fulfillment.items.map((item) => (
                        <li key={item.lineItemId} className={styles.itemListEntry}>
                          {formatCount(item.quantity)} × {item.title}
                          {item.sku ? ` (${item.sku})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FulfillmentForm orderId={orderId} />
    </div>
  );
}
