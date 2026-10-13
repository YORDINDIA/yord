import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import NewProductForm from '@/components/products/NewProductForm';

export const metadata: Metadata = { title: 'New product · YORD Admin' };

/**
 * New product.
 *
 * The form (`NewProductForm`) submits the same `createProductAction` with the
 * same field names; this page only supplies the header, the back link, and the
 * draft note — a new product has no status control and always starts as a draft
 * (`newProductSchema` defaults it).
 */
export default function NewProductPage() {
  return (
    <>
      <PageHeader
        icon={PackagePlus}
        tone="indigo"
        title="New product"
        description="Create a draft listing, then add images, collections, and details."
        actions={
          <Link className="button" href="/products">
            <ArrowLeft size={14} aria-hidden />
            Back to catalog
          </Link>
        }
      />

      <div className="card">
        <NewProductForm />
      </div>
    </>
  );
}
