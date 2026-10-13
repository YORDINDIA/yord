'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@yord/ui';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type OverlayVariant = 'center' | 'right' | 'full';

/** Kept in step with the `duration-300` on the panel transitions below. */
const EXIT_MS = 300;

const BACKDROP =
  'fixed inset-0 z-50 bg-scrim/70 backdrop-blur-sm transition-[opacity,visibility] duration-300 ease-out';

/**
 * A scrim rather than a surface token: the page behind a modal is dimmed, and
 * `--scrim` is the one token that is dark in both themes by design. A
 * `bg-surface-page/80` veil (the cart drawer's original) reads as a white wash
 * in the light theme and leaves a light panel on a light page with no edge.
 */
const PANEL: Record<OverlayVariant, string> = {
  // The `center` frame carries no width: it comes from CENTER_WIDTH below, so
  // a caller's width can replace it instead of racing it.
  center:
    'fixed left-1/2 top-1/2 z-50 max-h-[90vh] overflow-y-auto overscroll-contain ' +
    '-translate-x-1/2 -translate-y-1/2 bg-surface-card border border-border-default shadow-[var(--shadow-xl)] ' +
    'transition-[opacity,scale,visibility] duration-300 ease-out',
  right:
    'fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-surface-page border-l border-border-default ' +
    'flex flex-col overscroll-contain transition-[translate,visibility] duration-300 ease-out',
  full: 'fixed inset-0 z-50 bg-surface-page overflow-y-auto overscroll-contain transition-[opacity,visibility] duration-300 ease-out',
};

/**
 * Width of the `center` panel, replacing the default box rather than adding to
 * it. That is the whole point of the prop: a `max-w-*` handed in through
 * `className` competes with the panel's own class at the same specificity, so
 * which one wins is Tailwind's output order — true today, a contract never.
 *
 * `md` is the exact box the panel carried before this existed.
 */
const CENTER_WIDTH = {
  md: 'w-[calc(100%-2rem)] max-w-lg',
  lg: 'w-[calc(100%-2rem)] max-w-3xl',
  // The quick view: 900px from `md` up, gutter-width on a phone.
  xl: 'w-[calc(100%-2rem)] md:w-[900px] md:max-w-[900px]',
} as const;

export type OverlayWidth = keyof typeof CENTER_WIDTH;

const OPEN: Record<OverlayVariant, string> = {
  center: 'visible opacity-100 scale-100',
  right: 'visible translate-x-0',
  full: 'visible opacity-100',
};

/**
 * Closed states use `invisible`, not just opacity: a `visibility: hidden`
 * subtree is out of the tab order, so the panel's controls cannot be reached
 * while it is off screen.
 */
const CLOSED: Record<OverlayVariant, string> = {
  center: 'invisible opacity-0 scale-95 pointer-events-none',
  right: 'invisible translate-x-full pointer-events-none',
  full: 'invisible opacity-0 pointer-events-none',
};

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** id of the heading inside the panel. Preferred: the dialog reads its name. */
  labelledBy?: string;
  /** Fallback name when the panel has no heading of its own. */
  label?: string;
  variant?: OverlayVariant;
  /**
   * Width of the `center` panel. It replaces the default box, so it cannot
   * lose to Tailwind's output order the way a `max-w-*` in `className` does.
   * Ignored by `right`/`full`, which are sized by their own variant.
   */
  width?: OverlayWidth;
  /** Focused on open. Defaults to the first focusable control in the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * The shared modal / drawer shell: portal, backdrop click-to-close, focus trap,
 * Escape, body scroll lock, and focus restore. Generalised from CartDrawer so
 * there is exactly one implementation of each — the four hand-rolled copies
 * (CartDrawer, SearchModal, QuickViewModal, mobile nav) disagreed on scroll
 * locking and none of them trapped Tab.
 *
 * The panel stays mounted through its exit transition and is driven by classes
 * rather than being unmounted, so opening and closing animate. It mounts on the
 * first open (not on first render), so a page full of product cards does not
 * carry a hidden dialog per card.
 */
export function Overlay({
  open,
  onClose,
  children,
  labelledBy,
  label,
  variant = 'center',
  width = 'md',
  initialFocusRef,
  className,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // `present` = in the DOM at all; `entered` = transitioned to the open state.
  // Two flags because the panel has to outlive `open` for the exit transition,
  // and both are set from animation-frame/timeout callbacks rather than
  // synchronously in the effect body.
  const [present, setPresent] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      // Two frames, not one: the first paints the panel in its closed state,
      // which is the value the browser transitions *from*. Collapsing both into
      // one frame can land before that paint, and the browser then only ever
      // sees the open state — no transition at all.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        setPresent(true);
        inner = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    let hide = 0;
    const fade = requestAnimationFrame(() => setEntered(false));
    hide = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => {
      cancelAnimationFrame(fade);
      window.clearTimeout(hide);
    };
  }, [open]);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  // Gated on `entered`, not just `open`: focus cannot land in the panel while
  // it is still `invisible`, and the trap must start from the visible state.
  useFocusTrap(panelRef, open && entered, { initialFocusRef });

  // Nothing is rendered on the server: `present` only ever becomes true from a
  // frame callback, so `document` is never touched during SSR.
  if (!present) return null;

  const visible = open && entered;

  return createPortal(
    <>
      {variant !== 'full' ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className={cn(BACKDROP, visible ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none')}
        />
      ) : null}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-hidden={!open}
        // The trap falls back to focusing the panel itself when it holds no
        // focusable control; a div cannot take focus without this.
        tabIndex={-1}
        className={cn(
          PANEL[variant],
          variant === 'center' && CENTER_WIDTH[width],
          visible ? OPEN[variant] : CLOSED[variant],
          'motion-reduce:transition-none',
          className
        )}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
