'use client';

import type { ReactNode } from 'react';

/**
 * Bulk-action bar for list tables.
 *
 * Owns its own `<form>`, so it is never nested inside the filter `<form>` and
 * never wraps the table. `products/page.tsx` previously wrapped the whole table
 * in one form, which pushed the submit button far below the fold on a phone.
 * Selection is client state; the ticked ids go into hidden inputs.
 *
 * Renders as `.toolbar.bulk-actions` — the tinted accent bar in globals.css —
 * with the count as a `.badge` pill and the caller's controls pushed to the far
 * edge by `.spacer`.
 */
export default function BulkActions({
  action,
  selected,
  children,
  label = 'Bulk:',
  onSubmit,
}: {
  /** The `useActionState` form action for the bulk mutation. */
  action: (formData: FormData) => void | Promise<void>;
  /** Currently selected row ids, as strings. */
  selected: string[];
  children: ReactNode;
  label?: string;
  onSubmit?: () => void;
}) {
  const count = selected.length;
  return (
    <form action={action} className="toolbar bulk-actions" onSubmit={onSubmit}>
      {selected.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <span className="helper">{label}</span>
      <span className="badge" aria-live="polite">
        {count === 0 ? 'Tick rows to select' : `${count} selected`}
      </span>
      <span className="spacer" />
      {children}
    </form>
  );
}
