'use client';

import { useEffect, useRef } from 'react';

/**
 * Escape-to-close for an overlay.
 *
 * Handlers are stacked rather than each listening independently: with two
 * overlays open, both listeners see the same keypress and Escape would close
 * the outer one as well as the inner one — dismissing a quick view would also
 * throw away the search results behind it. Only the most recently opened
 * overlay answers, and it drops off the stack when it closes.
 */
const stack: symbol[] = [];

export function useEscapeKey(isOpen: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape);

  // Kept in a ref so a caller passing an inline arrow (the normal case) does
  // not re-register on every render — re-registering would move this overlay
  // to the top of the stack and let the outer one steal Escape back.
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol('escape');
    stack.push(token);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1] !== token) return;
      handler.current();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(token);
      if (at !== -1) stack.splice(at, 1);
    };
  }, [isOpen]);
}
