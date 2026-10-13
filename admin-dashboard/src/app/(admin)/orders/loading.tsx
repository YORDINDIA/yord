import { ShoppingCart } from 'lucide-react';
import TableSkeleton from '@/components/data/TableSkeleton';
import PageHeader from '@/components/ui/PageHeader';

/** Order list loading state: the real header, stat grid, and table shape. */
export default function OrdersLoading() {
  return (
    <>
      <PageHeader
        icon={ShoppingCart}
        tone="blue"
        title="Orders"
        description="Payment, fulfillment, and refunds."
      />
      <div className="stat-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <span className="skeleton skeleton-line" style={{ width: 120 }} />
        </div>
        <TableSkeleton rows={10} columns={6} />
      </div>
    </>
  );
}
