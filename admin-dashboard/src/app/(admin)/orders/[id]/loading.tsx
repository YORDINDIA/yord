import { Receipt } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import styles from '@/components/orders/orders.module.css';

/**
 * Order detail loading state.
 *
 * Mirrors the real page's shape — header strip, the status strip, four main
 * cards, and the 320px side rail's four cards — so the swap in does not
 * reflow the layout.
 */
export default function OrderDetailLoading() {
  return (
    <>
      <PageHeader icon={Receipt} tone="blue" title="Order" description="Loading order…" />

      {/* Status strip: two state pills plus the placed/paid chips. */}
      <div className={styles.metaStrip} aria-hidden="true">
        <span className="skeleton" style={{ width: 96, height: 24, borderRadius: 999 }} />
        <span className="skeleton" style={{ width: 110, height: 24, borderRadius: 999 }} />
        <span className="skeleton" style={{ width: 120, height: 24, borderRadius: 999 }} />
        <span className="skeleton" style={{ width: 96, height: 24, borderRadius: 999 }} />
      </div>

      <div className="layout-split">
        <div className="stack">
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
          {/* Transactions — the page's fourth main card. */}
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
        </div>
        <div className="side-rail">
          <div className="card">
            <div className="row">
              <span className="skeleton skeleton-block" style={{ width: 40, height: 40 }} />
              <div className="stack-sm" style={{ flex: 1 }}>
                <span className="skeleton skeleton-line" />
                <span className="skeleton skeleton-line" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
          {/* Statuses form card. */}
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 2 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
              <span className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
            </div>
          </div>
          {/* Refund panel card. */}
          <div className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading order…</span>
    </>
  );
}
