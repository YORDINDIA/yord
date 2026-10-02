import Link from 'next/link';
import type { Metadata } from 'next';
import NewProductForm from '@/components/products/NewProductForm';

export const metadata: Metadata = { title: 'New Product · YORD Admin' };

export default function NewProductPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Product</div>
          <div className="helper">Create a draft listing and add details later.</div>
        </div>
        <Link className="button" href="/products">
          Back
        </Link>
      </div>
      <NewProductForm />
    </div>
  );
}
