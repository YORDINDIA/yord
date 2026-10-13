import { TicketPlus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

/** New-discount loading state: the header, the three sections, and the rail. */
export default function NewDiscountLoading() {
  return (
    <>
      <PageHeader
        icon={TicketPlus}
        title="New discount"
        description="A price rule plus the coupon code shoppers type at checkout."
      />
      <div className="layout-split">
        <div className="stack">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className="form-section">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
            </div>
          ))}
          <span className="sr-only">Loading the discount form…</span>
        </div>
        <aside className="side-rail">
          <span className="skeleton skeleton-card" />
        </aside>
      </div>
    </>
  );
}
