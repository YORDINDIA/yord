'use client';

import { Check, Truck } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import { FREE_FAST_SHIPPING_THRESHOLD } from '@/lib/shipping';

interface ShippingProgressProps {
  subtotal: number;
}

/**
 * "How close am I to free *fast* shipping", as a real progress bar.
 *
 * Not a fee gate: shipping is free at every cart value. The one tier still
 * conditional is speed — FREE Fast at or above `FREE_FAST_SHIPPING_THRESHOLD`
 * — so below it the shopper already has FREE Standard and the copy says what
 * the extra buys.
 *
 * The bar was a plain `<div>` with no `role`/`aria-valuenow`, the percentage
 * was a raw glyph (`✓`), and the state was carried by colour alone. The
 * message now states the same fact the bar draws, and the bar exposes it to
 * assistive tech.
 */
export function ShippingProgress({ subtotal }: ShippingProgressProps) {
  const hasFreeFastShipping = subtotal >= FREE_FAST_SHIPPING_THRESHOLD;
  const amountToFreeFastShipping = Math.max(FREE_FAST_SHIPPING_THRESHOLD - subtotal, 0);
  const progress = Math.min((subtotal / FREE_FAST_SHIPPING_THRESHOLD) * 100, 100);

  const message = hasFreeFastShipping
    ? 'Free fast shipping unlocked'
    : `Add ${formatPrice(amountToFreeFastShipping)} for free fast shipping`;

  return (
    <div className="mb-8 p-6 bg-surface-card border border-border-default">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Truck size={18} aria-hidden="true" className="text-accent shrink-0" />
          <span className="font-body text-sm text-text-secondary">{message}</span>
        </div>
        {/* Decorative: the message above already carries the state in words. */}
        <span
          aria-hidden="true"
          className="flex items-center gap-1 font-accent text-sm tracking-wider text-accent shrink-0"
        >
          {hasFreeFastShipping ? <Check size={16} /> : `${Math.round(progress)}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Free fast shipping progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-valuetext={message}
        className="h-2 bg-surface-raised rounded-full overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-hover to-accent transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
