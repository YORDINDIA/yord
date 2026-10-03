import MetaRow from './MetaRow';
import styles from './orders.module.css';
import type { OrderExtras } from '@/lib/data/orders';
import type { Order } from '@yord/db-types';

/**
 * The order's own metadata: which channel it came through, its numbers, its
 * tags, and the note a customer or an admin left on it.
 *
 * `note`, `tags`, `source_name` and `confirmation_number` are columns the
 * generated `Order` type omits, so the detail read types them through
 * `OrderExtras`. Every one of them has a designed empty line rather than a blank
 * card, because a Shopify-imported order frequently has none of them.
 */
export default function OrderDetailsCard({
  order,
  id,
  currency,
}: {
  order: Order & OrderExtras;
  /** The route's lossless decimal string — never the parsed number. */
  id: string;
  currency: string;
}) {
  const tags = (order.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    <div className="card">
      <div className="card-header">
        <span className="section-title">Order details</span>
      </div>

      <dl className={styles.totals}>
        <MetaRow label="Order number">{order.order_number ?? '—'}</MetaRow>
        <MetaRow label="Order id">
          <span className="chip mono">{id}</span>
        </MetaRow>
        <MetaRow label="Channel">{order.source_name || 'online store'}</MetaRow>
        {order.confirmation_number && (
          <MetaRow label="Confirmation">{order.confirmation_number}</MetaRow>
        )}
        <MetaRow label="Currency">{currency}</MetaRow>
        {order.cancel_reason && <MetaRow label="Cancel reason">{order.cancel_reason}</MetaRow>}
      </dl>

      <div style={{ marginTop: 10 }}>
        <div className="helper">Tags</div>
        {tags.length === 0 ? (
          <p className="helper" style={{ margin: '4px 0 0' }}>
            No tags on this order.
          </p>
        ) : (
          <div className="tag-list" style={{ marginTop: 4 }}>
            {tags.map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="helper">Note</div>
        {order.note ? (
          <p className="helper helper-strong" style={{ margin: '4px 0 0' }}>
            {order.note}
          </p>
        ) : (
          <p className="helper" style={{ margin: '4px 0 0' }}>
            No note on this order.
          </p>
        )}
      </div>
    </div>
  );
}
