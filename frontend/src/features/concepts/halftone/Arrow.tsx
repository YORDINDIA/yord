import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@yord/ui';

/** Up-right arrow, drawn so its bounding box is the exact centre of the viewBox. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 12.5 12.5 3.5M5.5 3.5h7v7" />
    </svg>
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} data-cursor="pointer" className={cn('ht-link', className)}>
      {children}
      <Arrow className="ht-link__arrow" />
    </Link>
  );
}
