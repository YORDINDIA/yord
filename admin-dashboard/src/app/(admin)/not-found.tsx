import { FileQuestion } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

/**
 * 404 for admin routes.
 *
 * Detail pages call `notFound()` when a row does not exist, so a deleted
 * product, order, customer, or blog lands here instead of rendering an empty
 * editor. The recovery stays deliberately generic — no single list is the
 * right way back for every entity that can 404, and the sidebar carries them
 * all — so the one action is the page that is always correct: the dashboard.
 */
export default function AdminNotFound() {
  return (
    <div className="card mx-auto max-w-[560px]">
      <EmptyState
        tone="slate"
        icon={<FileQuestion size={24} aria-hidden="true" />}
        title="Page not found"
        hint="That record does not exist. It may have been deleted, or the link is older than the data behind it — a stale link gives no warning before it lands here. Nothing was changed."
        actionLabel="Go to dashboard"
        actionHref="/dashboard"
      >
        <span className="badge neutral badge-lg">404</span>
      </EmptyState>
    </div>
  );
}
