'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ChevronRight, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Shield, Truck, RotateCcw } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cartStore';
import { formatPrice, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const FREE_SHIPPING_THRESHOLD = 2999;

export function CartContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true });

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const subtotal = useCartStore((state) => state.subtotal());
  const itemCount = useCartStore((state) => state.itemCount());
  const totalSavings = useCartStore((state) => state.totalSavings());

  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

  return (
    <section ref={containerRef} className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
      {/* Breadcrumb */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        className="mb-8"
      >
        <ol className="flex items-center gap-2 text-sm font-[family-name:var(--font-jakarta)]">
          <li>
            <Link href="/" className="text-ivory-400 hover:text-gold-200 transition-colors">
              Home
            </Link>
          </li>
          <ChevronRight size={14} className="text-ivory-600" />
          <li className="text-ivory-100">Shopping Bag</li>
        </ol>
      </motion.nav>

      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.1 }}
        className="mb-12"
      >
        <div className="flex items-center gap-4">
          <div className="w-1 h-12 rounded-full bg-gold-200" />
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50">
            Shopping Bag
          </h1>
        </div>
        <p className="mt-4 font-[family-name:var(--font-jakarta)] text-ivory-400">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} in your bag
        </p>
      </motion.div>

      {items.length === 0 ? (
        /* Empty Cart State */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-24 text-center"
        >
          <ShoppingBag size={64} className="mx-auto text-noir-600 mb-6" />
          <h2 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-100 mb-4">
            Your bag is empty
          </h2>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 max-w-md mx-auto mb-8">
            Looks like you haven't added anything to your bag yet.
            Discover our exclusive artist collections.
          </p>
          <Link href="/">
            <Button variant="gold" size="lg">
              START SHOPPING
              <ArrowRight size={18} />
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {/* Free Shipping Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 }}
              className="mb-8 p-6 bg-noir-900 border border-noir-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-gold-200" />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
                    {hasFreeShipping
                      ? 'Congratulations! You have FREE shipping!'
                      : `Add ${formatPrice(amountToFreeShipping)} for FREE shipping`
                    }
                  </span>
                </div>
                <span className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-gold-200">
                  {hasFreeShipping ? '✓' : `${Math.round(shippingProgress)}%`}
                </span>
              </div>
              <div className="h-2 bg-noir-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-400 to-gold-200 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${shippingProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>

            {/* Items List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 }}
              className="divide-y divide-noir-800"
            >
              {items.map((item, index) => (
                <motion.div
                  key={item.variantId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="py-6 first:pt-0"
                >
                  <div className="flex gap-6">
                    {/* Image */}
                    <Link
                      href={`/product/${item.productHandle}`}
                      className="relative w-28 h-36 md:w-32 md:h-40 bg-noir-900 shrink-0 group"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-gold-200/10" />
                          <span className="absolute text-ivory-400 text-xs">No image</span>
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Artist */}
                      {item.artist && (
                        <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.15em] text-gold-200">
                          {item.artist.toUpperCase()}
                        </span>
                      )}

                      {/* Title */}
                      <Link
                        href={`/product/${item.productHandle}`}
                        className="block font-[family-name:var(--font-cormorant)] text-xl md:text-2xl text-ivory-50 hover:text-gold-200 transition-colors line-clamp-2 mt-1"
                      >
                        {item.title}
                      </Link>

                      {/* Variant */}
                      {item.variantTitle && (
                        <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mt-1">
                          Size: {item.variantTitle}
                        </p>
                      )}

                      {/* Price Row */}
                      <div className="flex flex-wrap items-center gap-4 mt-4">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-noir-700">
                          <button
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            className="w-10 h-10 flex items-center justify-center text-ivory-400 hover:text-ivory-50 hover:bg-noir-800 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-12 h-10 flex items-center justify-center text-ivory-50 font-[family-name:var(--font-jakarta)]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            disabled={item.quantity >= item.maxQuantity}
                            className={cn(
                              'w-10 h-10 flex items-center justify-center transition-colors',
                              item.quantity >= item.maxQuantity
                                ? 'text-noir-600 cursor-not-allowed'
                                : 'text-ivory-400 hover:text-ivory-50 hover:bg-noir-800'
                            )}
                            aria-label="Increase quantity"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        {/* Unit Price */}
                        <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                          {formatPrice(item.price)} each
                        </span>
                      </div>

                      {/* Stock Warning */}
                      {item.maxQuantity <= 5 && (
                        <p className="mt-3 text-sm text-amber-500 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Only {item.maxQuantity} left in stock
                        </p>
                      )}
                    </div>

                    {/* Price & Remove */}
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="w-10 h-10 flex items-center justify-center text-ivory-400 hover:text-red-500 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="text-right">
                        <p className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        {item.compareAtPrice && item.compareAtPrice > item.price && (
                          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 line-through">
                            {formatPrice(item.compareAtPrice * item.quantity)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
              className="sticky top-28 bg-noir-900 border border-noir-800 p-6"
            >
              <h2 className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-ivory-50 mb-6">
                ORDER SUMMARY
              </h2>

              {/* Subtotal */}
              <div className="space-y-4 pb-6 border-b border-noir-700">
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    Subtotal ({itemCount} items)
                  </span>
                  <span className="font-[family-name:var(--font-jakarta)] text-ivory-100">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                {totalSavings > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                      You're saving
                    </span>
                    <span className="font-[family-name:var(--font-jakarta)] text-emerald-500">
                      -{formatPrice(totalSavings)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    Shipping
                  </span>
                  <span className="font-[family-name:var(--font-jakarta)] text-ivory-100">
                    {hasFreeShipping ? (
                      <span className="text-emerald-500">FREE</span>
                    ) : (
                      'Calculated at checkout'
                    )}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-6 border-b border-noir-700">
                <span className="font-[family-name:var(--font-bebas)] text-lg tracking-[0.1em] text-ivory-50">
                  TOTAL
                </span>
                <span className="font-[family-name:var(--font-cormorant)] text-3xl text-ivory-50">
                  {formatPrice(subtotal)}
                </span>
              </div>

              {/* Checkout Button */}
              <div className="pt-6 space-y-4">
                <Link href="/checkout">
                  <Button variant="gold" fullWidth size="lg">
                    PROCEED TO CHECKOUT
                  </Button>
                </Link>

                <Link
                  href="/"
                  className="block text-center font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 hover:text-gold-200 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-8 pt-6 border-t border-noir-700 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Shield size={18} className="mx-auto mb-2 text-gold-200" />
                  <span className="block text-[10px] text-ivory-400 font-[family-name:var(--font-jakarta)]">
                    Secure Checkout
                  </span>
                </div>
                <div className="text-center">
                  <Truck size={18} className="mx-auto mb-2 text-gold-200" />
                  <span className="block text-[10px] text-ivory-400 font-[family-name:var(--font-jakarta)]">
                    Pan-India Delivery
                  </span>
                </div>
                <div className="text-center">
                  <RotateCcw size={18} className="mx-auto mb-2 text-gold-200" />
                  <span className="block text-[10px] text-ivory-400 font-[family-name:var(--font-jakarta)]">
                    Easy Returns
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}
