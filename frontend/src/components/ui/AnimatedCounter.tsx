'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  formatAbbreviated?: boolean;
}

export function AnimatedCounter({
  value,
  suffix = '',
  prefix = '',
  duration = 2,
  className = '',
  formatAbbreviated = false,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const count = useMotionValue(0);

  const displayValue = useTransform(count, (latest) => {
    const rounded = Math.round(latest);
    if (formatAbbreviated && rounded >= 1000) {
      return `${Math.round(rounded / 1000)}K`;
    }
    return rounded.toString();
  });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, {
        duration,
        ease: 'easeOut',
      });
      return () => controls.stop();
    }
  }, [isInView, value, duration, count]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}
