import { cn } from '@/lib/utils';

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
    default: 'bg-noir-700 text-ivory-100',
    sale: 'bg-gradient-to-r from-red-600 to-red-500 text-white',
    new: 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white',
    limited: `
      bg-gradient-to-r from-gold-200 to-gold-400 text-noir-950
      shadow-[0_0_20px_rgba(255,217,102,0.3)]
    `,
    soldout: 'bg-noir-600 text-ivory-400',
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
      style={{ borderColor: color, color }}
    >
      {artist}
    </Badge>
  );
}
