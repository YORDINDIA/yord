import { cn } from '@yord/ui';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * The button recipe, shared by `Button` (a real `<button>`) and `CtaLink` (a
 * `next/link` that has to look identical).
 *
 * It lives in its own module because there was no way to borrow the styling
 * without borrowing the element: six places nested `<Button>` inside `<Link>`,
 * which renders an `<a>` containing a `<button>` — invalid HTML, and the inner
 * button swallows the click and the link's own keyboard behaviour.
 *
 * The focus indicator is deliberately NOT part of the recipe. `globals.css`
 * paints `:focus-visible { outline: 2px solid var(--focus-ring) }`, and the
 * previous per-button `ring-accent ring-offset-surface-page` stacked a second
 * ring on top of it, with an offset colour that is only correct when the button
 * sits directly on the page surface.
 */
const BASE =
  'relative inline-flex items-center justify-center font-accent tracking-[0.15em] uppercase transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `
    bg-accent text-text-on-accent
    hover:bg-accent-hover hover:shadow-[var(--shadow-gold)]
    active:scale-[0.98]
  `,
  secondary: `
    bg-transparent text-text-primary border border-text-primary
    hover:bg-text-primary hover:text-text-on-accent
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent text-text-secondary
    hover:bg-surface-raised hover:text-text-primary
    active:scale-[0.98]
  `,
  gold: `
    bg-gradient-to-r from-accent to-accent-hover text-text-on-accent
    hover:shadow-[var(--shadow-gold)]
    active:scale-[0.98]
  `,
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  className?: string
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className);
}
