import { Settings } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TableSkeleton from '@/components/data/TableSkeleton';

/**
 * Loading state for `/settings`.
 *
 * Mirrors the default (admins) view's shape — page header, stat strip, the
 * admin table card, and the add-admin card below it — so the layout does not
 * jump when the reads land. The header tabs stay out on purpose: the active
 * tab comes from `?tab=`, which this boundary cannot read, and a wrong active
 * tab would be worse than a missing tab row for a moment.
 */
export default function SettingsLoading() {
  return (
    <>
      <PageHeader
        icon={Settings}
        tone="slate"
        title="Settings"
        description="Admins, access, and the audit trail."
      />

      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card" aria-busy="true" aria-live="polite">
        <div className="card-header">
          <div>
            <div className="section-title">Loading…</div>
            <div className="helper">
              Fetching administrators, their identities, and the audit trail.
            </div>
          </div>
        </div>
        <TableSkeleton rows={6} columns={5} />
      </div>
      {/* The default view's second card (AddAdminForm). */}
      <div className="card" aria-hidden="true">
        <div className="stack-sm">
          <span className="skeleton skeleton-title" style={{ width: 140 }} />
          <span className="skeleton skeleton-line" style={{ width: '55%' }} />
          <div className="form-grid">
            <span className="skeleton" style={{ height: 36, borderRadius: 8 }} />
            <span className="skeleton" style={{ height: 36, borderRadius: 8 }} />
          </div>
          <span className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
        </div>
      </div>
    </>
  );
}
