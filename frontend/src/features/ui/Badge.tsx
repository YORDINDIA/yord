import { cn } from '@yord/ui';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'sale';
  /**
   * Status chip (order state, stock). Replaces `variant` when set: the two
   * sets answer different questions — what the product *is* versus what state
   * it is *in* — so a badge is one or the other, never a mix.
   */
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  tone,
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center justify-center font-accent tracking-[0.1em] uppercase whitespace-nowrap';

  const variants = {
    default: 'bg-surface-inset text-text-secondary',
    // Filled status badges use --text-on-accent, not `text-white`: the ink has
    // to flip with the fill, because the dark theme's danger/success are light
    // colours. White on the old `red-500` gradient was 3.5:1 at 10px — below
    // AA for text this small. Now 6.25:1 light / 7.16:1 dark.
    sale: 'bg-danger text-text-on-accent',
  };

  /**
   * Tonal chips: a 10% wash of the tone under the tone as ink, which is the
   * shape the account order rows inlined in two files. `neutral` uses the
   * inset surface because it is not a status — it is the resting state.
   */
  const tones = {
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    neutral: 'bg-surface-inset text-text-muted',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      className={cn(baseStyles, tone ? tones[tone] : variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

// Pre-styled badge variants
export function SaleBadge({ discount }: { discount: number }) {
  // No `animate-pulse`: a discount badge that never stops pulsing is the kind
  // of motion `prefers-reduced-motion` exists to remove, and dropping it is
  // cleaner than shipping a permanently-animating element with an opt-out.
  return <Badge variant="sale">{discount}% OFF</Badge>;
}
