'use client';

import { useRouter } from 'next/navigation';
import { ErrorState } from './ErrorState';

/**
 * Inline error + retry for degraded server sections (homepage blocks,
 * sidebars). Retry re-runs the server components via `router.refresh()`.
 */
export function SectionRetry({
  title = 'Could not load this section',
  message = 'Check your connection and try again.',
}: {
  title?: string;
  message?: string;
}) {
  const router = useRouter();
  return (
    <ErrorState
      title={title}
      message={message}
      onRetry={() => router.refresh()}
      retryLabel="Retry"
      showHomeLink={false}
    />
  );
}
