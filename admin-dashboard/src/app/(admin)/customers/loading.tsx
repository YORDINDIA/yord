import { Users } from 'lucide-react';
import TableSkeleton from '@/components/data/TableSkeleton';
import PageHeader from '@/components/ui/PageHeader';

/**
 * Loading state for the customer list.
 *
 * Mirrors the real page's shape (page header, stat strip, then one card
 * holding the filter bar and the table) so the layout does not jump when the
 * data lands. Shaped blocks rather than a spinner; the export button that
 * sits in the real header is a client component fed by the rows, so it has
 * no loading placeholder.
 */
export default function CustomersLoading() {
  return (
    <>
      <PageHeader
        icon={Users}
        title="Customers"
        description="Buyers, spend, and contact history."
        tone="cyan"
      />

      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="card-header">
          <div>
            <div className="section-title">Customers</div>
            <div className="helper">Fetching buyers, spend, and last order dates…</div>
          </div>
        </div>

        {/* FilterBar placeholder: search field, marketing select, submit. */}
        <div className="toolbar filter-bar" aria-hidden="true">
          <span className="skeleton" style={{ width: 220, height: 36, borderRadius: 8 }} />
          <span className="skeleton" style={{ width: 170, height: 36, borderRadius: 8 }} />
          <span className="spacer" />
          <span className="skeleton" style={{ width: 88, height: 36, borderRadius: 8 }} />
        </div>

        <TableSkeleton rows={8} columns={6} />
      </div>
    </>
  );
}
