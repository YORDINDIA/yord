import { PackagePlus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

/** New-product loading state: the header, then the form's section shapes. */
export default function NewProductLoading() {
  return (
    <>
      <PageHeader
        icon={PackagePlus}
        title="New product"
        description="Create a draft listing, then add images, collections, and details."
        animated={false}
      />
      <div className="card">
        <div className="stack" aria-busy="true" aria-live="polite">
          {Array.from({ length: 4 }, (_, section) => (
            <div key={section} className="form-section">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
            </div>
          ))}
          <span className="sr-only">Loading the product form…</span>
        </div>
      </div>
    </>
  );
}
