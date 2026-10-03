'use client';

import { useRouter } from 'next/navigation';

/* Shown when the catalogue read failed or came back empty. */
export function RetryNote({ children }: { children: string }) {
  const router = useRouter();
  return (
    <p className="ht-retry">
      <span>{children}</span>
      <button type="button" className="ht-link" onClick={() => router.refresh()}>
        Try again
      </button>
    </p>
  );
}
