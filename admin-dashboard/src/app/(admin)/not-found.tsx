import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

/**
 * 404 for admin routes.
 *
 * Detail pages call `notFound()` when a row does not exist, so a deleted product
 * or a mistyped id lands here instead of rendering an empty editor.
 */
export default function AdminNotFound() {
  return (
    <div className="card">
      <EmptyState
        title="Not found"
        hint="That record does not exist, or it was deleted. It may have been reachable from a stale link."
        icon={<FileQuestion size={28} />}
      />
      <div className="toolbar" style={{ justifyContent: 'center' }}>
        <Link className="button primary" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
