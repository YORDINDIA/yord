'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cartStore';
import { formatPrice, cn } from '@yord/ui';
import { isPriceOnSale } from '@/lib/product';
import { FREE_SHIPPING_THRESHOLD, FREE_FAST_SHIPPING_THRESHOLD } from '@/lib/shipping';
import { Button } from '@/features/ui/Button';

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());
  const itemCount = useCartStore((state) => state.itemCount());

  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const fastShippingProgress = Math.min((subtotal / FREE_FAST_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const amountToFreeFastShipping = Math.max(FREE_FAST_SHIPPING_THRESHOLD - subtotal, 0);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const hasFreeFastShipping = subtotal >= FREE_FAST_SHIPPING_THRESHOLD;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll, move focus inside, and trap Tab while open; Escape
  // closes. `aria-modal="true"` without this leaves keyboard users in the
  // background or strands focus when the drawer unmounts.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
    // Focus the first control once the drawer mounts.
    const raf = requestAnimationFrame(() => focusables()[0]?.focus());
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCart();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKey);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, closeCart]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-surface-page/80 backdrop-blur-sm z-50"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            ref={dialogRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface-page border-l border-border-default z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} className="text-accent" />
                <h2 className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-text-primary">
                  YOUR BAG ({itemCount})
                </h2>
              </div>
              <button
                onClick={closeCart}
                className="w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close cart"
              >
                <X size={24} />
              </button>
            </div>

            {/* Free Shipping Progress */}
            {items.length > 0 && (
              <div className="px-6 py-4 border-b border-border-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted">
                    {hasFreeFastShipping
                      ? 'You have FREE fast shipping!'
                      : hasFreeShipping
                        ? `Free standard! Add ${formatPrice(amountToFreeFastShipping)} for fast`
                        : `Add ${formatPrice(amountToFreeShipping)} for FREE shipping`
                    }
                  </span>
                  <span className="text-xs text-accent">
                    {hasFreeFastShipping ? '✓' : `${Math.round(hasFreeShipping ? fastShippingProgress : shippingProgress)}%`}
                  </span>
                </div>
                <div className="h-1 bg-surface-raised overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${hasFreeShipping ? fastShippingProgress : shippingProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <ShoppingBag size={48} className="text-text-muted mb-4" />
                  <h3 className="font-[family-name:var(--font-cormorant)] text-xl text-text-secondary mb-2">
                    Your bag is empty
                  </h3>
                  <p className="text-sm text-text-muted mb-6">
                    Discover our exclusive artist collections
                  </p>
                  <Button onClick={closeCart} variant="secondary">
                    CONTINUE SHOPPING
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border-default">
                  {items.map((item, index) => (
                    <motion.li
                      key={item.variantId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-6"
                    >
                      <div className="flex gap-4">
                        {/* Image */}
                        <Link
                          href={`/product/${item.productHandle}`}
                          onClick={closeCart}
                          className="relative w-20 h-24 bg-surface-card shrink-0"
                        >
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
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
                            <span className="text-[10px] font-[family-name:var(--font-bebas)] tracking-[0.1em] text-accent">
                              {item.artist.toUpperCase()}
                            </span>
                          )}

                          {/* Title */}
                          <Link
                            href={`/product/${item.productHandle}`}
                            onClick={closeCart}
                            className="block font-[family-name:var(--font-cormorant)] text-lg text-text-primary hover:text-accent transition-colors line-clamp-1"
                          >
                            {item.title}
                          </Link>

                          {/* Variant */}
                          {item.variantTitle && (
                            <p className="text-xs text-text-muted mt-0.5">
                              {item.variantTitle}
                            </p>
                          )}

                          {/* Price & Quantity */}
                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity Controls */}
                            <div className="flex items-center border border-border-default">
                              <button
                                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 h-8 flex items-center justify-center text-sm text-text-primary">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                className={cn(
                                  'w-8 h-8 flex items-center justify-center transition-colors',
                                  item.quantity >= item.maxQuantity
                                    ? 'text-text-muted cursor-not-allowed'
                                    : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
                                )}
                                aria-label="Increase quantity"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="font-[family-name:var(--font-jakarta)] text-text-primary font-medium">
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
                          onClick={() => removeItem(item.variantId)}
                          className="self-start w-8 h-8 flex items-center justify-center text-text-muted hover:text-red-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border-default p-6 space-y-4">
                {/* Savings */}
                {totalSavings > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">You&apos;re saving</span>
                    <span className="text-emerald-500 font-medium">
                      {formatPrice(totalSavings)}
                    </span>
                  </div>
                )}

                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-text-muted">
                    SUBTOTAL
                  </span>
                  <span className="font-[family-name:var(--font-cormorant)] text-2xl text-text-primary">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <p className="text-xs text-text-muted text-center">
                  Shipping & taxes calculated at checkout
                </p>

                {/* Checkout Button */}
                <Link href="/checkout" onClick={closeCart}>
                  <Button variant="gold" fullWidth size="lg">
                    PROCEED TO CHECKOUT
                  </Button>
                </Link>

                {/* Continue Shopping */}
                <button
                  onClick={closeCart}
                  className="w-full text-center text-sm text-text-muted hover:text-accent transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
