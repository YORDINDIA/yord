'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cartStore';
import { usePromoPercent, usePromoStore } from '@/lib/stores/promoStore';
import { track } from '@/lib/analytics/track';
import { computeTotals } from '@/lib/pricing';
import { formatPrice, cn } from '@yord/ui';
import { isPriceOnSale } from '@/lib/product';
import { FREE_FAST_SHIPPING_THRESHOLD } from '@/lib/shipping';
import { Button } from '@/features/ui/Button';
import { CtaLink } from '@/features/ui/CtaLink';
import { IconButton } from '@/features/ui/IconButton';
import { Overlay } from '@/features/ui/Overlay';
import { PromoCode } from '@/features/checkout/PromoCode';

const TITLE_ID = 'cart-drawer-title';

/**
 * The cart drawer.
 *
 * The hand-rolled version of everything an overlay needs — body scroll lock,
 * focus move, Tab trap, Escape, focus restore — now comes from `Overlay`, so
 * the lock is reference-counted (opening a quick view on top no longer releases
 * it) and Escape goes to the topmost overlay only.
 *
 * Two visible changes: the backdrop is `--scrim` instead of a `surface-page`
 * veil (which read as a white wash in the light theme and left a light panel on
 * a light page with no edge), and opening focuses the close button rather than
 * the first product image.
 */
export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());
  const itemCount = useCartStore((state) => state.itemCount());

  // The promo discount, from the same store the checkout rail reads. The cart
  // drawer previously showed a subtotal only; now it shows what the code takes
  // off and a total, so the number on PROCEED TO CHECKOUT matches what the
  // checkout page will say. The percent is the last *checked* value — the
  // server prices the order itself.
  const promoCode = usePromoStore((state) => state.code);
  const promoPercent = usePromoPercent();
  const { discountAmount, total } = computeTotals(items, promoPercent);

  // Shipping is free at every cart value; only the speed is conditional, so
  // the bar tracks the fast threshold alone.
  const fastShippingProgress = Math.min((subtotal / FREE_FAST_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeFastShipping = Math.max(FREE_FAST_SHIPPING_THRESHOLD - subtotal, 0);
  const hasFreeFastShipping = subtotal >= FREE_FAST_SHIPPING_THRESHOLD;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Analytics: snapshot the cart once per open. Totals are read through
  // getState so the effect cannot re-fire when quantities change while the
  // drawer stays open, and an empty cart is not a "cart viewed".
  useEffect(() => {
    if (!isOpen) return;
    const current = useCartStore.getState().items;
    if (current.length === 0) return;
    track({
      type: 'cart_viewed',
      cartValue: current.reduce((sum, i) => sum + i.price * i.quantity, 0),
      cartItems: current.reduce((sum, i) => sum + i.quantity, 0),
    });
  }, [isOpen]);

  return (
    <Overlay
      open={isOpen}
      onClose={closeCart}
      variant="right"
      labelledBy={TITLE_ID}
      initialFocusRef={closeButtonRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <div className="flex items-center gap-3">
          <ShoppingBag size={20} className="text-accent" aria-hidden="true" />
          <h2 id={TITLE_ID} className="font-accent text-lg tracking-[0.1em] text-text-primary">
            YOUR BAG ({itemCount})
          </h2>
        </div>
        <IconButton ref={closeButtonRef} label="Close cart" onClick={closeCart}>
          <X size={24} />
        </IconButton>
      </div>

      {/* Free *fast* shipping progress. Shipping is free at every value, so
          this tracks the one conditional tier: the speed upgrade. The sentence
          above the bar already carries the meaning, so the bar itself is
          decorative — a `role="progressbar"` here would announce a percentage
          twice. */}
      {items.length > 0 && (
        <div className="px-6 py-4 border-b border-border-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">
              {hasFreeFastShipping
                ? 'You have FREE fast shipping!'
                : `Free standard shipping — add ${formatPrice(amountToFreeFastShipping)} for fast`}
            </span>
            <span className="text-xs text-accent" aria-hidden="true">
              {hasFreeFastShipping ? '✓' : `${Math.round(fastShippingProgress)}%`}
            </span>
          </div>
          <div className="h-1 bg-surface-raised overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${fastShippingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <ShoppingBag size={48} className="text-text-muted mb-4" aria-hidden="true" />
            <h3 className="font-heading text-xl text-text-secondary mb-2">Your bag is empty</h3>
            <p className="text-sm text-text-muted mb-6">Discover our exclusive artist collections</p>
            <Button onClick={closeCart} variant="secondary">
              CONTINUE SHOPPING
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border-default">
            {items.map((item) => (
              <li key={item.variantId} className="p-6">
                <div className="flex gap-4">
                  {/* Image */}
                  <Link
                    href={`/product/${item.productHandle}`}
                    onClick={closeCart}
                    className="relative w-20 h-24 bg-surface-card shrink-0"
                  >
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs">
                        No image
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Artist */}
                    {item.artist && (
                      <span className="text-[10px] font-accent tracking-[0.1em] text-accent">
                        {item.artist.toUpperCase()}
                      </span>
                    )}

                    {/* Title */}
                    <Link
                      href={`/product/${item.productHandle}`}
                      onClick={closeCart}
                      className="block font-heading text-lg text-text-primary hover:text-accent transition-colors line-clamp-1"
                    >
                      {item.title}
                    </Link>

                    {/* Variant */}
                    {item.variantTitle && (
                      <p className="text-xs text-text-muted mt-0.5">{item.variantTitle}</p>
                    )}

                    {/* Price & Quantity */}
                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Controls. Each label names the product: a
                          screen reader otherwise hears "Decrease quantity"
                          once per line with no way to tell them apart. */}
                      <div className="flex items-center border border-border-default">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
                          aria-label={`Decrease quantity of ${item.title}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 h-8 flex items-center justify-center text-sm text-text-primary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          className={cn(
                            'w-8 h-8 flex items-center justify-center transition-colors',
                            item.quantity >= item.maxQuantity
                              ? 'text-text-muted cursor-not-allowed'
                              : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
                          )}
                          aria-label={`Increase quantity of ${item.title}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-body text-text-primary font-medium">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        {isPriceOnSale(item.price, item.compareAtPrice) && (
                          <p className="text-xs text-text-muted line-through">
                            {formatPrice((item.compareAtPrice ?? 0) * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="self-start w-8 h-8 flex items-center justify-center text-text-muted hover:text-danger transition-colors"
                    aria-label={`Remove ${item.title} from bag`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-border-default p-6 space-y-4">
          {/* Promo code. Above the totals because it changes them, and it
              closes the drawer before following its link to the quiz. */}
          <PromoCode surface="cart" onNavigate={closeCart} />

          {/* Savings */}
          {totalSavings > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">You&apos;re saving</span>
              <span className="text-success font-medium">{formatPrice(totalSavings)}</span>
            </div>
          )}

          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="font-accent text-sm tracking-[0.1em] text-text-muted">SUBTOTAL</span>
            <span className="font-heading text-2xl text-text-primary">{formatPrice(subtotal)}</span>
          </div>

          {/* The discount, shown against the subtotal it came off. Only when a
              code is actually applied — an empty "−₹0" row is noise. */}
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">
                Promo {promoCode ? <span className="font-mono">{promoCode}</span> : null}
              </span>
              <span className="text-accent font-medium">−{formatPrice(discountAmount)}</span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between border-t border-border-default pt-3">
              <span className="font-accent text-sm tracking-[0.1em] text-text-primary">TOTAL</span>
              <span className="font-heading text-2xl text-text-primary">{formatPrice(total)}</span>
            </div>
          )}

          <p className="text-xs text-text-muted text-center">
            Free shipping · GST calculated at checkout
          </p>

          {/* Checkout. `CtaLink`, not `<Link><Button>`: the latter nests a
              `<button>` inside an `<a>`, and the inner button swallows the
              click and the link's own keyboard behaviour. */}
          <CtaLink href="/checkout" onClick={closeCart} variant="gold" size="lg" fullWidth>
            PROCEED TO CHECKOUT
          </CtaLink>

          {/* Continue Shopping */}
          <button
            type="button"
            onClick={closeCart}
            className="w-full text-center text-sm text-text-muted hover:text-accent transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      )}
    </Overlay>
  );
}
