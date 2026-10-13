'use client';

import { useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  formatAbbreviated?: boolean;
}

/** Same shape the previous framer-motion transform produced: `50000` → `50K`. */
function formatCount(latest: number, abbreviated: boolean): string {
  const rounded = Math.round(latest);
  if (abbreviated && rounded >= 1000) {
    return `${Math.round(rounded / 1000)}K`;
  }
  return rounded.toString();
}

/**
 * Count-up on first view.
 *
 * Plain IntersectionObserver + requestAnimationFrame, with the number written
 * straight to the DOM node: a 2s count-up costs one observer and one rAF loop,
 * and zero React renders. That zero-re-render behaviour is what the framer
 * motion value gave us before, without the library.
 */
export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 2,
  className = '',
  formatAbbreviated = false,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const numberEl = numberRef.current;
    if (!el || !numberEl) return;

    const write = (latest: number) => {
      numberEl.textContent = formatCount(latest, formatAbbreviated);
    };

    // Reduced motion: show the finished number immediately, never animate it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      write(value);
      return;
    }

    let frame = 0;
    let startedAt = 0;

    const step = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress =
        duration > 0 ? Math.min((now - startedAt) / (duration * 1000), 1) : 1;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      write(value * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          frame = requestAnimationFrame(step);
        }
      },
      { rootMargin: '-100px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, formatAbbreviated]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {/*
        The final value is what the server renders, so a visitor without JS (or
        before hydration) reads "50K+", not "0+". The first animation frame
        writes 0 and counts up from there, so the visible behaviour is
        unchanged for everyone else.
      */}
      <span ref={numberRef}>{formatCount(value, formatAbbreviated)}</span>
      {suffix}
    </span>
  );
}
