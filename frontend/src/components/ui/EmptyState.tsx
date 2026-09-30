import type { ReactNode } from 'react';

/**
 * Standard empty state: what is missing, one line of guidance, and an
 * optional action. Server-safe.
 */
export function EmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-16 text-center">
      <p className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-100 mb-3">{title}</p>
      {message ? (
        <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-6">{message}</p>
      ) : null}
      {children}
    </div>
  );
}
