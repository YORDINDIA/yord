import { cn } from '@yord/ui';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'sale' | 'new' | 'limited' | 'soldout' | 'artist';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const baseStyles = `
    inline-flex items-center justify-center
    font-[family-name:var(--font-bebas)] tracking-[0.1em] uppercase
    whitespace-nowrap
  `;

  const variants = {
    default: 'bg-surface-inset text-text-secondary',
    sale: 'bg-gradient-to-r from-red-600 to-red-500 text-white',
    new: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white',
    limited: `
      bg-gradient-to-r from-accent to-accent-hover text-text-on-accent
      glow-gold
    `,
    soldout: 'bg-surface-inset text-text-muted',
    artist: 'bg-transparent border border-current',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  );
}

// Pre-styled badge variants
export function SaleBadge({ discount }: { discount: number }) {
  return (
    <Badge variant="sale" className="animate-pulse">
      {discount}% OFF
    </Badge>
  );
}

export function NewBadge() {
  return <Badge variant="new">NEW</Badge>;
}

export function LimitedBadge() {
  return (
    <Badge variant="limited" className="shimmer">
      LIMITED EDITION
    </Badge>
  );
}

export function SoldOutBadge() {
  return <Badge variant="soldout">SOLD OUT</Badge>;
}

export function ArtistBadge({
  artist,
  color,
}: {
  artist: string;
  color?: string;
}) {
  return (
    <Badge
      variant="artist"
      // The artist colour stays as the rule; the label uses the theme accent so
      // it stays readable (marshmello white on a white badge was 1.1:1).
      style={{ borderColor: color, color: 'var(--accent)' }}
    >
      {artist}
    </Badge>
  );
}
