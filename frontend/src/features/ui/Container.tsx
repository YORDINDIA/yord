import { cn } from '@yord/ui';
import type { HTMLAttributes, ElementType } from 'react';

type ContainerTag =
  | 'div'
  | 'section'
  | 'main'
  | 'header'
  | 'footer'
  | 'nav'
  | 'article'
  | 'aside';

const SIZES = {
  /** The storefront's page grid — `--max-width` in tokens.css. */
  default: 'max-w-[var(--max-width)]',
  /** Long-form reading: policy pages, blog article bodies. */
  narrow: 'max-w-4xl',
  /** Full-bleed sections that deliberately run wider than the page grid. */
  wide: 'max-w-[1728px]',
} as const;

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ContainerTag;
  size?: keyof typeof SIZES;
}

/**
 * The page-width wrapper. Replaces the
 * `max-w-[1440px] mx-auto px-6 lg:px-12` string that was copy-pasted across
 * every route and feature — one place to change the page grid, and one place
 * that knows the horizontal gutter.
 *
 * `container-page` in globals.css is the same box as a utility, for the handful
 * of places that need it on an element they do not control.
 *
 * Server-safe: no state, no effects.
 */
export function Container({
  as = 'div',
  size = 'default',
  className,
  children,
  ...props
}: ContainerProps) {
  const As = as as ElementType;
  return (
    <As className={cn('mx-auto w-full px-6 lg:px-12', SIZES[size], className)} {...props}>
      {children}
    </As>
  );
}
