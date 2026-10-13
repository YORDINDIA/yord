import { FolderPlus } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

/** New-collection loading state: the header, then the form's section shapes. */
export default function NewCollectionLoading() {
  return (
    <>
      <PageHeader
        icon={FolderPlus}
        title="New collection"
        description="Manual and smart merchandising groups."
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
          <span className="sr-only">Loading the collection form…</span>
        </div>
      </div>
    </>
  );
}
