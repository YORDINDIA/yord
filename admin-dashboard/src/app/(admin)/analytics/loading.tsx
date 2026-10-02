import { BarChart3 } from 'lucide-react';
import styles from '@/components/dashboard/dashboard.module.css';
import PageHeader from '@/components/ui/PageHeader';

/**
 * Route-level loading state for analytics.
 *
 * Mirrors the real page — KPI strip, the 8/4 revenue-and-catalog row, the 6/6
 * products row, and the 4/8 stock-and-notes row — so the grid does not jump
 * when the reads land. The range tabs are deliberately left out: the active tab
 * comes from `?range=`, which this boundary cannot read, and rendering a wrong
 * tab active would be worse than rendering none for a moment.
 */
export default function AnalyticsLoading() {
  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Revenue trend, product performance, and stock health for a chosen window."
      />

      <div className={styles.kpiRow} aria-busy="true" aria-live="polite">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>

      <div className="dash-grid">
        <div className="col-8">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-chart" />
          </section>
        </div>
        <div className="col-4">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-chart" />
          </section>
        </div>
        <div className="col-6">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <span className="skeleton skeleton-chart" />
          </section>
        </div>
        <div className="col-6">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="skeleton skeleton-card" />
              ))}
            </div>
          </section>
        </div>
        <div className="col-4">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm">
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </section>
        </div>
        <div className="col-8">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </section>
        </div>
      </div>

      <span className="sr-only">Loading analytics…</span>
    </>
  );
}
