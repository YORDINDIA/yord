'use client';

import { useEffect, useState } from 'react';
import { SCROLL_THRESHOLD } from './headerTone';

/**
 * `true` once the page has scrolled past `threshold`.
 *
 * Passive listener: the header only reads `scrollY`, and a non-passive listener
 * would make the browser wait on it before scrolling.
 */
export function useScrollState(threshold: number = SCROLL_THRESHOLD): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Read the starting position in a frame rather than synchronously: a page
    // restored mid-scroll (back navigation) would otherwise keep a transparent
    // header until the first scroll event. A frame callback, not the effect
    // body, because setState-in-effect is a lint error here.
    const raf = requestAnimationFrame(onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return isScrolled;
}
