'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cartStore';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const FREE_SHIPPING_THRESHOLD = 2999;

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const closeCart = useCartStore((state) => state.closeCart);
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.subtotal());
  const totalSavings = useCartStore((state) => state.totalSavings());

  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
            className="fixed inset-0 bg-noir-950/80 backdrop-blur-sm z-50"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-noir-950 border-l border-noir-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-noir-800">
              <div className="flex items-center gap-3">
                <ShoppingBag size={20} className="text-gold-200" />
                <h2 className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-ivory-50">
                  YOUR BAG ({items.length})
                </h2>
              </div>
              <button
                onClick={closeCart}
                className="w-10 h-10 flex items-center justify-center text-ivory-400 hover:text-ivory-50 transition-colors"
                aria-label="Close cart"
              >
                <X size={24} />
              </button>
            </div>

            {/* Free Shipping Progress */}
            {items.length > 0 && (
              <div className="px-6 py-4 border-b border-noir-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-ivory-400">
                    {amountToFreeShipping > 0
                      ? `Add ${formatPrice(amountToFreeShipping)} for FREE shipping`
                      : 'You have FREE shipping!'
                    }
                  </span>
                  <span className="text-xs text-gold-200">
                    {shippingProgress >= 100 ? '✓' : `${Math.round(shippingProgress)}%`}
                  </span>
                </div>
                <div className="h-1 bg-noir-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gold-200"
                    initial={{ width: 0 }}
                    animate={{ width: `${shippingProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <ShoppingBag size={48} className="text-noir-600 mb-4" />
                  <h3 className="font-[family-name:var(--font-cormorant)] text-xl text-ivory-100 mb-2">
                    Your bag is empty
                  </h3>
                  <p className="text-sm text-ivory-400 mb-6">
                    Discover our exclusive artist collections
                  </p>
                  <Button onClick={closeCart} variant="secondary">
                    CONTINUE SHOPPING
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-noir-800">
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
                          className="relative w-20 h-24 bg-noir-900 shrink-0"
                        >
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-ivory-400 text-xs">
                              No image
                            </div>
                          )}
                        </Link>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Artist */}
                          {item.artist && (
                            <span className="text-[10px] font-[family-name:var(--font-bebas)] tracking-[0.1em] text-gold-200">
                              {item.artist.toUpperCase()}
                            </span>
                          )}

                          {/* Title */}
                          <Link
                            href={`/product/${item.productHandle}`}
                            onClick={closeCart}
                            className="block font-[family-name:var(--font-cormorant)] text-lg text-ivory-50 hover:text-gold-200 transition-colors line-clamp-1"
                          >
                            {item.title}
                          </Link>

                          {/* Variant */}
                          {item.variantTitle && (
                            <p className="text-xs text-ivory-400 mt-0.5">
                              {item.variantTitle}
                            </p>
                          )}

                          {/* Price & Quantity */}
                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity Controls */}
                            <div className="flex items-center border border-noir-700">
                              <button
                                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center text-ivory-400 hover:text-ivory-50 hover:bg-noir-800 transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 h-8 flex items-center justify-center text-sm text-ivory-50">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                className={cn(
                                  'w-8 h-8 flex items-center justify-center transition-colors',
                                  item.quantity >= item.maxQuantity
                                    ? 'text-noir-600 cursor-not-allowed'
                                    : 'text-ivory-400 hover:text-ivory-50 hover:bg-noir-800'
                                )}
                                aria-label="Increase quantity"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="font-[family-name:var(--font-jakarta)] text-ivory-50 font-medium">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                              {item.compareAtPrice && item.compareAtPrice > item.price && (
                                <p className="text-xs text-ivory-400 line-through">
                                  {formatPrice(item.compareAtPrice * item.quantity)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="self-start w-8 h-8 flex items-center justify-center text-ivory-400 hover:text-red-500 transition-colors"
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
              <div className="border-t border-noir-800 p-6 space-y-4">
                {/* Savings */}
                {totalSavings > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ivory-400">You&apos;re saving</span>
                    <span className="text-emerald-500 font-medium">
                      {formatPrice(totalSavings)}
                    </span>
                  </div>
                )}

                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] text-ivory-400">
                    SUBTOTAL
                  </span>
                  <span className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <p className="text-xs text-ivory-400 text-center">
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
                  className="w-full text-center text-sm text-ivory-400 hover:text-gold-200 transition-colors"
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
