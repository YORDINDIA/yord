'use client';

import {
  useInView,
  useMotionValue,
  useSpring,
} from 'motion/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { useReducedMotion } from '@/lib/reduced-motion';
import { formatCurrency } from '@/lib/utils/format';

// Layout effects are a no-op during SSR; the isomorphic swap
// keeps the server console clean while still filling the span
// before the first paint on the client.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface StatNumberProps {
  /** The figure to count up to. */
  to: number;
  /** Where the count starts. 0 reads as "the number arriving". */
  from?: number;
  /** Spring pace, tuned per duration so short counts stay snappy. */
  duration?: number;
  /**
   * 'count' groups through `en-IN` (lakh style, like the rest
   * of the panel); 'currency' runs the app's own INR formatter
   * so an animated figure can never drift from a static one.
   */
  kind?: 'count' | 'currency';
  className?: string;
}

/**
 * The animated figure behind every stat tile. Ships the final
 * value in the server HTML (no-JS reads it, no layout shift),
 * then rewinds to `from` before the first paint and springs to
 * `to` once the tile scrolls into view. Under
 * `prefers-reduced-motion` the figure is simply painted, static.
 */
export default function StatNumber({
  to,
  from = 0,
  duration = 1.4,
  kind = 'count',
  className,
}: StatNumberProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, {
    damping: 20 + 40 / duration,
    stiffness: 100 / duration,
  });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const format = useCallback(
    (value: number) =>
      kind === 'currency'
        ? formatCurrency(value)
        : new Intl.NumberFormat('en-IN').format(Math.round(value)),
    [kind],
  );

  // Before paint: the span already carries the final value from
  // SSR, so rewind it to the start (or leave it, reduced motion)
  // before the user sees a single frame.
  useIsomorphicLayoutEffect(() => {
    if (ref.current) ref.current.textContent = reduce ? format(to) : format(from);
  }, [reduce, from, to, format]);

  // A late `from` change must move the MotionValue with the span:
  // the hook only reads `from` on mount, so the value would
  // otherwise stay at the old start and the next spring would run
  // from below what the span shows. `jump` skips the spring (a
  // plain `set` would send it chasing the new start).
  useIsomorphicLayoutEffect(() => {
    if (reduce) return;
    motionValue.jump(from);
  }, [reduce, from, motionValue]);

  // Trigger the spring once the figure is on screen; `from` is a
  // dependency so a changed start re-runs the count from it.
  useEffect(() => {
    if (!isInView || reduce) return;
    const id = setTimeout(() => motionValue.set(to), 120);
    return () => clearTimeout(id);
  }, [isInView, reduce, motionValue, to, from]);

  // The spring writes through to the span on every tick.
  useEffect(() => {
    if (reduce) return;
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) ref.current.textContent = format(latest);
    });
    return unsubscribe;
  }, [springValue, format, reduce]);

  return (
    <span className={className} ref={ref}>
      {format(to)}
    </span>
  );
}
