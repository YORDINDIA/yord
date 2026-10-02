import { FileQuestion } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

/**
 * 404 for admin routes.
 *
 * Detail pages call `notFound()` when a row does not exist, so a deleted product
 * or a mistyped id lands here instead of rendering an empty editor. The two
 * actions point at the lists those ids usually came from — the sidebar is
 * there too, but the recovery should not require re-orientation.
 */
export default function AdminNotFound() {
  return (
    <div className="card mx-auto max-w-[560px]">
      <EmptyState
        tone="slate"
        icon={<FileQuestion size={24} aria-hidden="true" />}
        title="Page not found"
        hint="That record does not exist. It may have been deleted, or the link is older than the data behind it — a stale link gives no warning before it lands here. Nothing was changed."
        actionLabel="Go to products"
        actionHref="/products"
        secondaryAction={{ label: 'Go to orders', href: '/orders' }}
      >
        <span className="badge neutral badge-lg">404</span>
      </EmptyState>
    </div>
  );
}
