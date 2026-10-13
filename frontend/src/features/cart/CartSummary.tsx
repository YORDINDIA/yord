'use client';

import { RotateCcw, Shield, Truck } from 'lucide-react';
import Link from 'next/link';
import { cn, formatPrice } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import { shippingLabel } from '@/lib/shipping';
import { CtaLink } from '@/features/ui/CtaLink';
import { TrustBadges, type TrustBadgeItem } from '@/features/ui/TrustBadges';

/**
 * The cart's three promises. Shipping is free on every order, so the badge no
 * longer quotes a threshold — the one conditional tier is *speed*, which the
 * summary's own shipping line states (`FREE Fast` above the fast threshold).
 */
const CART_TRUST_BADGES: readonly TrustBadgeItem[] = [
  { icon: Shield, label: 'Secure Checkout' },
  { icon: Truck, label: 'Free Shipping' },
  { icon: RotateCcw, label: '14-Day Returns' },
];

export interface CartSummaryProps {
  className?: string;
}

/**
 * Bag totals + the checkout CTA.
 *
 * The CTA used to be `<Link href="/checkout"><Button>` — an `<a>` wrapping a
 * `<button>`, invalid HTML whose click and keyboard semantics sit on the inner
 * element. `CtaLink` is the link that looks like a button.
 */
export function CartSummary({ className }: CartSummaryProps) {
  const itemCount = useCartStore((state) => state.itemCount());
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());

  // Always a free tier: shipping is free at every cart value and only the
  // speed changes. `lib/shipping.ts` owns the label so this summary and the
  // checkout summary cannot drift.
  const shipping = shippingLabel(subtotal);

  return (
    <div className={cn('sticky top-28 bg-surface-card border border-border-default p-6', className)}>
      <h2 className="font-accent text-lg tracking-[0.1em] text-text-primary mb-6">
        ORDER SUMMARY
      </h2>

      <div className="space-y-4 pb-6 border-b border-border-default">
        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-text-muted">
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
          <span className="font-body text-text-secondary">{formatPrice(subtotal)}</span>
        </div>

        {totalSavings > 0 && (
          <div className="flex items-center justify-between">
            <span className="font-body text-sm text-text-muted">You&apos;re saving</span>
            <span className="font-body text-success">-{formatPrice(totalSavings)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-text-muted">Shipping</span>
          <span className="font-body text-success">{shipping}</span>
        </div>
      </div>

      <div className="py-6 border-b border-border-default">
        <div className="flex items-center justify-between">
          <span className="font-accent text-lg tracking-[0.1em] text-text-primary">TOTAL</span>
          <span className="font-heading text-3xl text-text-primary">{formatPrice(subtotal)}</span>
        </div>
        <p className="mt-2 font-body text-xs text-text-muted">
          GST is added at checkout.
        </p>
      </div>

      <div className="pt-6 space-y-4">
        <CtaLink href="/checkout" variant="gold" size="lg" fullWidth>
          PROCEED TO CHECKOUT
        </CtaLink>

        <Link
          href="/"
          className="block text-center font-body text-sm text-text-muted hover:text-accent transition-colors"
        >
          Continue Shopping
        </Link>
      </div>

      <TrustBadges
        items={CART_TRUST_BADGES}
        size="sm"
        className="mt-8 border-t border-border-default pt-6"
      />
    </div>
  );
}
