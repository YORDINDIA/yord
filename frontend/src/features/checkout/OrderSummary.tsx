'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Tag } from 'lucide-react';
import { cn, formatPrice } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import { isPriceOnSale } from '@/lib/product';
import { computeTotals, GST_RATE } from '@/lib/pricing';
import { shippingLabel } from '@/lib/shipping';
import { EmptyState } from '@/features/ui/EmptyState';
import { CtaLink } from '@/features/ui/CtaLink';

export interface OrderSummaryProps {
  className?: string;
}

/**
 * Line items + totals for the checkout rail.
 *
 * The shipping line is always a free tier — `FREE Fast` at or above the fast
 * threshold, `FREE Standard` below it — because shipping is free on every
 * order. No branch here ever adds an amount.
 *
 * The total is `subtotal + GST`, the same money path both checkout routes
 * charge and the order row is written with (`total_shipping_price: 0`), so the
 * displayed total is exactly what Razorpay collects.
 */
export function OrderSummary({ className }: OrderSummaryProps) {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());

  const { gstAmount, total } = computeTotals(subtotal);

  const shipping = shippingLabel(subtotal);

  if (items.length === 0) {
    return (
      <div className={cn('bg-surface-card border border-border-default', className)}>
        <EmptyState
          title="Your cart is empty"
          message="Add something to your bag to see it summarised here."
          className="py-10"
        >
          <CtaLink href="/" variant="secondary" size="sm">
            CONTINUE SHOPPING
          </CtaLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={cn('bg-surface-card border border-border-default', className)}>
      {/* Header */}
      <div className="p-6 border-b border-border-default">
        <h3 className="font-display text-xl text-text-primary">
          Order Summary
        </h3>
        <p className="font-body text-sm text-text-muted mt-1">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Items. Capped so a twelve-line order never pushes the total out of
          the sticky rail it sits in. */}
      <div className="divide-y divide-border-default max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div key={item.variantId} className="p-4 flex gap-4">
            {/* Image */}
            <div className="relative w-16 h-20 flex-shrink-0 bg-surface-raised">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-text-muted" aria-hidden="true" />
                </div>
              )}
              {/* Quantity Badge. The number is decorative here; the count is
                  read from the text below so it is not announced twice. */}
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 w-5 h-5 bg-accent text-text-on-accent text-xs font-bold flex items-center justify-center"
              >
                {item.quantity}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              {item.artist && (
                <p className="font-body text-xs text-accent uppercase tracking-wider">
                  {item.artist}
                </p>
              )}
              <Link
                href={`/product/${item.productHandle}`}
                className="font-heading text-sm text-text-secondary hover:text-accent line-clamp-2 transition-colors"
              >
                {item.title}
              </Link>
              {item.variantTitle && item.variantTitle !== 'Default Title' && (
                <p className="font-body text-xs text-text-muted mt-1">
                  {item.variantTitle}
                </p>
              )}
              <p className="font-body text-xs text-text-muted mt-1">
                Qty {item.quantity}
              </p>
            </div>

            {/* Price */}
            <div className="text-right">
              <p className="font-body text-sm text-text-secondary">
                {formatPrice(item.price * item.quantity)}
              </p>
              {isPriceOnSale(item.price, item.compareAtPrice) && (
                <p className="font-body text-xs text-text-muted line-through">
                  {formatPrice((item.compareAtPrice ?? 0) * item.quantity)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="p-6 border-t border-border-default space-y-3">
        <div className="flex justify-between font-body text-sm">
          <span className="text-text-muted">Subtotal</span>
          <span className="text-text-secondary">{formatPrice(subtotal)}</span>
        </div>

        {totalSavings > 0 && (
          <div className="flex justify-between font-body text-sm">
            <span className="text-success flex items-center gap-1">
              <Tag size={14} aria-hidden="true" />
              Savings
            </span>
            <span className="text-success">-{formatPrice(totalSavings)}</span>
          </div>
        )}

        <div className="flex justify-between font-body text-sm">
          <span className="text-text-muted">Shipping</span>
          <span className="text-success">{shipping}</span>
        </div>

        <div className="flex justify-between font-body text-sm">
          <span className="text-text-muted">Tax ({Math.round(GST_RATE * 100)}% GST)</span>
          <span className="text-text-secondary">{formatPrice(gstAmount)}</span>
        </div>

        <div className="pt-3 border-t border-border-default">
          <div className="flex justify-between">
            <span className="font-display text-lg text-text-primary">
              Total
            </span>
            <span className="font-display text-lg text-accent">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
