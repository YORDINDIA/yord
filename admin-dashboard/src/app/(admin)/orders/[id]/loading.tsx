import { Receipt } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

/**
 * Order detail loading state.
 *
 * Mirrors the real page's shape — header strip, main column of cards, 320px side
 * rail — so the swap in does not reflow the layout.
 */
export default function OrderDetailLoading() {
  return (
    <>
      <PageHeader icon={Receipt} tone="blue" title="Order" description="Loading order…" />
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
        </div>
      </div>
      <span className="sr-only">Loading order…</span>
    </>
  );
}
