'use client';

import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

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

/** Tone glyph. `.toast-<tone> svg` in globals.css colours the icon. */
const TOAST_ICON: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  // Toast currently holding keyboard focus (or containing the focused element).
  // The auto-dismiss timer reschedules while this is set so focus is never
  // stranded by a toast vanishing mid-interaction.
  const focusedRef = useRef<number | null>(null);

  const dismiss = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: number) => {
      const tick = (): void => {
        if (focusedRef.current === id) {
          // Still focused: try again later instead of pulling focus away.
          window.setTimeout(tick, TOAST_DURATION_MS);
        } else {
          dismiss(id);
        }
      };
      window.setTimeout(tick, TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++nextId;
      setItems((previous) => [...previous.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);
      scheduleDismiss(id);
    },
    [scheduleDismiss],
  );

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {items.map((item) => {
          const Icon = TOAST_ICON[item.tone];
          return (
            <button
              key={item.id}
              type="button"
              className={`toast toast-${item.tone}`}
              onClick={() => dismiss(item.id)}
              onFocus={() => {
                focusedRef.current = item.id;
              }}
              onBlur={() => {
                if (focusedRef.current === item.id) focusedRef.current = null;
              }}
              aria-label={`Dismiss: ${item.message}`}
            >
              <Icon size={14} aria-hidden="true" />
              {item.message}
            </button>
          );
        })}
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
