'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './catalog.css';

/**
 * Filters below `lg`: a button that opens the panel in a native `<dialog>`
 * bottom sheet. `showModal()` gives the focus trap, Esc and the inert page for
 * free. The panel's links navigate in place, so the sheet stays open while the
 * shopper refines and the result count on the close button updates with them.
 */
export function FilterDrawer({ count, activeCount, children }: { count: number; activeCount: number; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        // Only the trigger hides from lg: the dialog itself stays rendered, so a
        // sheet left open across a resize is still visible and closable rather
        // than an invisible modal holding the page's scroll lock.
        className="lg:hidden inline-flex items-center gap-2 bg-surface-card px-4 py-2 font-body text-sm font-semibold text-text-primary transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        Filters
        {activeCount > 0 && <span className="tabular-nums text-accent">{activeCount}</span>}
      </button>
      <dialog
        ref={ref}
        aria-label="Filters"
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => e.target === e.currentTarget && close()}
        className="catalog-sheet m-0 mt-auto h-auto open:flex open:flex-col max-h-[85dvh] w-full max-w-none bg-surface-page p-0 text-text-primary backdrop:bg-scrim/60"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <p className="font-display-alt text-2xl font-bold">Filters</p>
          <button
            type="button"
            onClick={close}
            aria-label="Close filters"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-text-muted hover:text-text-primary"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        <div className="bg-surface-page px-6 py-4">
          <button
            type="button"
            onClick={close}
            className="flex w-full items-center justify-center bg-accent px-4 py-3.5 font-body text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            Show {count} {count === 1 ? 'product' : 'products'}
          </button>
        </div>
      </dialog>
    </>
  );
}
