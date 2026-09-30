import Link from 'next/link';
import type { Metadata } from 'next';
import NewDiscountForm from '@/components/discounts/NewDiscountForm';

export const metadata: Metadata = { title: 'New Discount · YORD Admin' };

export default function NewDiscountPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Discount</div>
          <div className="helper">Create a price rule and code.</div>
        </div>
        <Link className="button" href="/discounts">
          Back
        </Link>
      </div>
      <NewDiscountForm />
    </div>
  );
}
