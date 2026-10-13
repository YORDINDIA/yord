'use client';

import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@yord/ui';

const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;
const PATH = `M${72 - R} 72a${R} ${R} 0 1 1 ${2 * R} 0a${R} ${R} 0 1 1 ${-2 * R} 0`;

interface RingCtaProps {
  /** Text set on the rotating ring. */
  label: string;
  /** How many times the label repeats around the ring. */
  repeat?: number;
  /** Centre of the ring: an arrow, or a word. */
  children: ReactNode;
  href?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/* A round call to action: text on a path rotates around a still centre. The
   fill swap on hover and focus is a colour change only, the ring never moves. */
export function RingCta({ label, repeat = 2, children, href, ariaLabel, disabled, className }: RingCtaProps) {
  const id = `ht-ring-${useId().replace(/\W/g, '')}`;
  const body = (
    <>
      <svg className="ht-ring__text" viewBox="0 0 144 144" aria-hidden="true">
        <defs>
          <path id={id} d={PATH} />
        </defs>
        <text>
          <textPath href={`#${id}`} textLength={CIRCUMFERENCE - 2} lengthAdjust="spacing">
            {`${label} · `.repeat(repeat)}
          </textPath>
        </text>
      </svg>
      <span className="ht-ring__core">{children}</span>
    </>
  );

  return href ? (
    <Link href={href} aria-label={ariaLabel} data-cursor="pointer" className={cn('ht-ring', className)}>
      {body}
    </Link>
  ) : (
    <button type="submit" aria-label={ariaLabel} disabled={disabled} data-cursor="pointer" className={cn('ht-ring', className)}>
      {body}
    </button>
  );
}
