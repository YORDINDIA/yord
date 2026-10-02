'use client';

import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import ClickSpark from './ClickSpark';
import { useReactBitsColors } from '@/lib/reactbits-theme';
import { useReducedMotion } from '@/lib/reduced-motion';

export interface SparkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** 'primary' adds the admin's filled primary styling. */
  variant?: 'primary' | 'plain';
}

/**
 * The admin's `<button>` with ReactBits' `ClickSpark` burst on click: the
 * press is answered by a short radial spark in the section accent. Feedback,
 * not decoration — the burst only exists while the pointer is down.
 *
 * Reduced motion: the plain button, no canvas.
 */
export default function SparkButton({
  children,
  variant = 'primary',
  className,
  ...rest
}: SparkButtonProps) {
  const reduce = useReducedMotion();
  const colors = useReactBitsColors();

  const button = (
    <button
      type="button"
      className={clsx('button', variant === 'primary' && 'primary', className)}
      {...rest}
    >
      {children}
    </button>
  );

  if (reduce) return button;

  return (
    <ClickSpark
      sparkColor={colors.accent}
      sparkCount={10}
      sparkRadius={16}
      sparkSize={9}
      duration={380}
    >
      {button}
    </ClickSpark>
  );
}
