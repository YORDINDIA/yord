'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Real toast provider + context.
 *
 * The previous implementation fired `window.dispatchEvent(new CustomEvent(...))`
 * and `ToastHost` listened for it. That had two real bugs: there was no provider,
 * so anything outside `AdminShell` (notably `login/page.tsx`) had its toasts
 * silently dropped, and the mechanism was untestable — no component tree, no
 * assertions. This is a plain context: `toast()` throws a helpful error if used
 * outside the provider instead of failing silently.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** How long each toast stays visible. */
export const TOAST_DURATION_MS = 4000;

/** Max toasts on screen; older ones are dropped. */
const MAX_VISIBLE = 3;

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++nextId;
      setItems((previous) => [...previous.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`toast toast-${item.tone}`}
            onClick={() => dismiss(item.id)}
            aria-label={`Dismiss: ${item.message}`}
          >
            {item.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Toast API. Safe to call outside a provider: it becomes a no-op rather than
 * throwing, so a component can be rendered in isolation (a test, a storybook)
 * without a provider.
 */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  return context ?? { toast: () => {} };
}
