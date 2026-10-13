'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { CartItem } from '@yord/db-types';
import { formatPrice } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import { useCartHydrated } from '@/hooks/useHydrated';
import { Button } from '@/features/ui/Button';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { Reveal } from '@/features/ui/Reveal';
import { CartLineItem } from './CartLineItem';
import { CartSummary } from './CartSummary';
import { ShippingProgress } from './ShippingProgress';

/**
 * The bag page.
 *
 * Two states used to be indistinguishable: "the store has not rehydrated yet"
 * rendered the same empty-cart takeover as "the bag is genuinely empty", so a
 * refresh flashed "Your bag is empty" before the persisted items arrived. The
 * hydrated flag gates that now, and the placeholder is a row-shaped skeleton
 * in the cart's own layout instead of a 4-up product grid.
 */
export function CartContent() {
  const hydrated = useCartHydrated();
  const items = useCartStore((state) => state.items);
  const itemCount = useCartStore((state) => state.itemCount());
  const subtotal = useCartStore((state) => state.subtotal());
  const removeItem = useCartStore((state) => state.removeItem);
  const addItem = useCartStore((state) => state.addItem);
  const closeCart = useCartStore((state) => state.closeCart);

  // Removed line + undo. Removing was instant and irreversible.
  const [removed, setRemoved] = useState<CartItem | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 8000);
    return () => clearTimeout(timer);
  }, [removed]);

  const handleRemove = (item: CartItem) => {
    removeItem(item.variantId);
    setRemoved(item);
  };

  const handleUndo = () => {
    if (!removed) return;
    addItem(removed, removed.quantity);
    // `addItem` opens the cart drawer; the shopper is already looking at the
    // bag, so it is closed again in the same event.
    closeCart();
    setRemoved(null);
  };

  return (
    <Container as="section" className="py-12 pb-32 lg:pb-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-sm font-body">
          <li>
            <Link href="/" className="text-text-muted hover:text-accent transition-colors">
              Home
            </Link>
          </li>
          <ChevronRight size={14} aria-hidden="true" className="text-text-muted" />
          <li aria-current="page" className="text-text-secondary">
            Shopping Bag
          </li>
        </ol>
      </nav>

      {/* Page Title */}
      <div className="mb-12">
        <div className="flex items-center gap-4">
          <div aria-hidden="true" className="w-1 h-12 rounded-full bg-accent" />
          <h1 className="font-display text-4xl md:text-5xl text-text-primary">
            Shopping Bag
          </h1>
        </div>
        {hydrated && (
          <p className="mt-4 font-body text-text-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} in your bag
          </p>
        )}
      </div>

      {!hydrated ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your bag is empty"
          message="Looks like you haven't added anything to your bag yet. Discover our exclusive artist collections."
        >
          <CtaLink href="/" variant="gold" size="lg">
            START SHOPPING
          </CtaLink>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <ShippingProgress subtotal={subtotal} />

              {/* Undo bar. `role="status"` so the removal is announced; the
                  button is the reversal, which is what "remove" lacked. */}
              {removed && (
                <div
                  role="status"
                  className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border-default bg-surface-card px-4 py-3"
                >
                  <p className="font-body text-sm text-text-secondary">
                    {removed.title} removed from your bag
                  </p>
                  <Button type="button" variant="ghost" size="sm" onClick={handleUndo}>
                    UNDO
                  </Button>
                </div>
              )}

              <Reveal className="divide-y divide-border-default">
                {items.map((item) => (
                  <CartLineItem key={item.variantId} item={item} onRemove={handleRemove} />
                ))}
              </Reveal>
            </div>

            {/* Order Summary. Deliberately not wrapped in `Reveal`: the
                summary is `sticky`, and a wrapper whose height is the
                summary's own height leaves a sticky element nothing to
                travel in. */}
            <div className="lg:col-span-1">
              <CartSummary />
            </div>
          </div>

          {/* Sticky mobile checkout bar. The summary CTA sits below every line
              item, so on a long bag the only way to pay was to scroll past
              them all. */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-page/95 px-6 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-xs text-text-muted">Total</p>
                <p className="font-heading text-xl text-text-primary">{formatPrice(subtotal)}</p>
              </div>
              <CtaLink href="/checkout" variant="gold">
                CHECKOUT
              </CtaLink>
            </div>
          </div>
        </>
      )}
    </Container>
  );
}

/** Row-shaped placeholder: same box as a line item, not a product grid. */
function CartSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading your bag" className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <div className="lg:col-span-2 space-y-6">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex gap-6" aria-hidden="true">
            <div className="w-28 h-36 md:w-32 md:h-40 shrink-0 animate-pulse bg-surface-raised" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-3 w-16 animate-pulse bg-surface-raised" />
              <div className="h-5 w-2/3 animate-pulse bg-surface-raised" />
              <div className="h-4 w-24 animate-pulse bg-surface-raised" />
              <div className="h-11 w-36 animate-pulse bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
      <div className="lg:col-span-1" aria-hidden="true">
        <div className="h-72 animate-pulse bg-surface-raised" />
      </div>
    </div>
  );
}
