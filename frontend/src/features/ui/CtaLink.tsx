'use client';

import Link from 'next/link';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface CtaLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/**
 * A `next/link` that looks like a `Button`.
 *
 * Use this instead of nesting a `<Button>` inside a `<Link>`: that renders an
 * `<a>` wrapping a `<button>`, which is invalid HTML and — worse — puts the
 * click and keyboard semantics on the inner element, so the link never
 * navigates on Enter.
 */
export function CtaLink({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  children,
  ...props
}: CtaLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, fullWidth, className)} {...props}>
      {children}
    </Link>
  );
}
