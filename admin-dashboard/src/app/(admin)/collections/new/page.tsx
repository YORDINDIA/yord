import Link from 'next/link';
import type { Metadata } from 'next';
import NewCollectionForm from '@/components/collections/NewCollectionForm';

export const metadata: Metadata = { title: 'New Collection · YORD Admin' };

export default function NewCollectionPage() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="section-title">New Collection</div>
          <div className="helper">Manual or rules-based merchandising.</div>
        </div>
        <Link className="button" href="/collections">
          Back
        </Link>
      </div>
      <NewCollectionForm />
    </div>
  );
}
