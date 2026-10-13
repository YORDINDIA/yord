'use client';

import ShinyText from './ShinyText';
import { useReducedMotion } from '@/lib/reduced-motion';

export interface BrandShimmerProps {
  text: string;
  className?: string;
  /** Base text colour (a token variable). */
  color?: string;
  /** The highlight that sweeps across. */
  shineColor?: string;
  /** Seconds per sweep. */
  speed?: number;
  spread?: number;
}

/**
 * The brand wordmark's shimmer sweep, wrapped so both call sites
 * (the sidebar and the login panel) share one reduced-motion
 * behaviour: `ShinyText`'s `disabled` prop freezes the gradient —
 * no sweep, no animation-frame loop.
 */
export default function BrandShimmer({
  text,
  className,
  color = 'var(--text-strong)',
  shineColor = 'var(--accent)',
  speed = 2.6,
  spread = 140,
}: BrandShimmerProps) {
  const reduce = useReducedMotion();
  return (
    <ShinyText
      text={text}
      className={className}
      color={color}
      shineColor={shineColor}
      speed={speed}
      spread={spread}
      disabled={reduce ?? false}
    />
  );
}
