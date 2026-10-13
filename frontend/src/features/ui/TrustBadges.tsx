import { RotateCcw, Shield, Truck, type LucideIcon } from 'lucide-react';
import { cn } from '@yord/ui';

export interface TrustBadgeItem {
  icon: LucideIcon;
  label: string;
  detail?: string;
}

/** Shipping / returns / secure payment, the three the storefront promises. */
export const DEFAULT_TRUST_BADGES: readonly TrustBadgeItem[] = [
  // Shipping is free on every order (owner decision) — there is no paid tier
  // and therefore no threshold to quote. Never reinstate "Over ₹X": it was the
  // *fast* tier's number sitting under the standard label, and both are gone.
  { icon: Truck, label: 'Free Shipping', detail: 'On all orders' },
  { icon: RotateCcw, label: 'Easy Returns', detail: '14 Days' },
  { icon: Shield, label: 'Secure Payment', detail: 'Razorpay' },
];

export interface TrustBadgesProps {
  items?: readonly TrustBadgeItem[];
  /** `md` shows the second line; `sm` is the label-only row. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The three-item trust row under the add-to-bag button, in the cart summary,
 * and on the checkout page. It was written out three times with drifting copy
 * ("Premium Quality" in one place, "Pan-India Delivery" in another), so the
 * canonical three live here and callers override only when they mean to.
 *
 * Border and spacing stay with the caller — they differ per placement — so pass
 * them through `className`.
 *
 * Server-safe.
 */
export function TrustBadges({
  items = DEFAULT_TRUST_BADGES,
  size = 'md',
  className,
}: TrustBadgesProps) {
  const iconSize = size === 'md' ? 20 : 18;

  return (
    <div className={cn('grid grid-cols-3 gap-4', className)}>
      {items.map(({ icon: Icon, label, detail }) => (
        <div key={label} className="text-center">
          <Icon size={iconSize} aria-hidden="true" className="mx-auto mb-2 text-accent" />
          <span
            className={cn(
              'block font-body text-text-muted',
              size === 'md' ? 'text-xs' : 'text-[10px]'
            )}
          >
            {label}
          </span>
          {size === 'md' && detail ? (
            <span className="block text-[10px] text-text-muted">{detail}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
