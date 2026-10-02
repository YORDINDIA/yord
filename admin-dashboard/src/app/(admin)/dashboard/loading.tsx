import { LayoutDashboard } from 'lucide-react';
import styles from '@/components/dashboard/dashboard.module.css';
import PageHeader from '@/components/ui/PageHeader';

/**
 * Route-level loading state for the dashboard.
 *
 * Shaped like the real page — the framed hero band, the KPI strip,
 * then the 8/4 and 6/3/3 rows — so the layout does not jump when the
 * reads resolve. A generic table skeleton (what `(admin)/loading.tsx`
 * renders) would be the wrong shape here and would make the page look
 * like it had finished loading a list.
 *
 * The header is static (`animated={false}`): it is a placeholder, and
 * re-running the title reveal when the real page replaces it would be
 * noise.
 */
export default function DashboardLoading() {
  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Storefront health at a glance: revenue, orders, fulfillment, and stock."
        animated={false}
      />

      <section className="card" style={{ minHeight: 86 }} aria-busy="true" aria-live="polite">
        <span className="skeleton skeleton-title" />
        <span className="skeleton" style={{ width: 220, height: 30, marginTop: 10 }} />
      </section>

      <div className={styles.kpiRow} aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
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
      </div>

      <div className="dash-grid">
        <div className="col-6">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </section>
        </div>
        <div className="col-3">
          <section className="card">
            <span className="skeleton skeleton-title" />
            <div className="stack-sm">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="skeleton skeleton-line" />
              ))}
            </div>
          </section>
        </div>
        <div className="col-3">
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

      <span className="sr-only">Loading the dashboard…</span>
    </>
  );
}
