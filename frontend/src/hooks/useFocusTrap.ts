'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Everything a browser will move focus to with Tab, minus disabled controls and
 * hidden inputs. Descendants hidden with `visibility: hidden` are deliberately
 * not filtered out — the trap only runs while the panel is visible, and a style
 * probe per Tab costs more than the edge case it removes.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  /** Focused when the trap opens. Defaults to the first focusable descendant. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Return focus to the pre-open element on close. Defaults to true. */
  restoreFocus?: boolean;
}

/**
 * Nested traps are stacked for the same reason `useEscapeKey` is: both
 * listeners see every Tab, and an outer trap would otherwise drag focus back
 * out of an inner overlay (its `contains` check fails for a node that is not
 * its own descendant). Only the topmost trap acts.
 */
const stack: symbol[] = [];

/**
 * Modal focus management: move focus in on open, keep Tab inside, restore focus
 * on close.
 *
 * `aria-modal="true"` without this leaves a keyboard user tabbing through the
 * page behind the dialog, and strands them wherever the browser lands when it
 * closes.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  { initialFocusRef, restoreFocus = true }: UseFocusTrapOptions = {}
): void {
  useEffect(() => {
    if (!isOpen) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    const token = Symbol('focus-trap');
    stack.push(token);

    // Focus after a frame: the panel is `invisible` until its open class lands,
    // and `visibility: hidden` elements cannot take focus.
    const raf = requestAnimationFrame(() => {
      (initialFocusRef?.current ?? focusable()[0] ?? node).focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (stack[stack.length - 1] !== token) return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // `!node.contains(active)` covers focus that escaped the panel (a stray
      // click on the backdrop, or a removed control) — the next Tab pulls it
      // back to the edge instead of continuing through the page behind.
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(token);
      if (at !== -1) stack.splice(at, 1);

      if (!restoreFocus) return;
      // An overlay that closed because the user navigated is unmounted by the
      // route change, so the panel is detached by cleanup time and the control
      // that opened it may be gone too. Restoring focus then would yank it back
      // from the page the user just landed on.
      if (!node.isConnected || !previous?.isConnected) return;
      previous.focus();
    };
  }, [ref, isOpen, initialFocusRef, restoreFocus]);
}
