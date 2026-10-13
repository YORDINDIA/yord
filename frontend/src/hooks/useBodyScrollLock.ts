'use client';

import { useEffect } from 'react';

/**
 * Reference-counted body scroll lock.
 *
 * One `document.body.style.overflow = 'hidden'` per overlay is wrong the moment
 * two are open: the inner one's cleanup restores `''` and releases the lock
 * while the outer overlay is still on screen. That is the real bug the four
 * uncoordinated copies had — QuickViewModal released the lock on unmount even
 * when CartDrawer was still open, so the page scrolled behind the drawer.
 *
 * Counting means the last overlay to close is the one that restores, and it
 * restores whatever was there before the first lock instead of a hardcoded ''.
 */
let locks = 0;
let previousOverflow = '';

export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    if (locks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
}
