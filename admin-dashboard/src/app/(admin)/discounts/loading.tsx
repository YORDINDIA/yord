import { Tags } from 'lucide-react';
import TableSkeleton from '@/components/data/TableSkeleton';
import PageHeader from '@/components/ui/PageHeader';

/** Discount list loading state: the real header, stat strip, and table shape. */
export default function DiscountsLoading() {
  return (
    <>
      <PageHeader
        icon={Tags}
        title="Discounts"
        description="Price rules, coupon codes, and redemptions."
      />
      <div className="stat-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="skeleton skeleton-line" style={{ width: 160 }} />
        </div>
        <TableSkeleton rows={10} columns={7} />
      </div>
    </>
  );
}
