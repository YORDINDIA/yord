'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/lib/stores/cartStore';
import { formatPrice, isPriceOnSale } from '@/lib/utils';
import { computeTotals } from '@/lib/pricing';
import { ShoppingBag, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderSummaryProps {
  isCompact?: boolean;
}

export function OrderSummary({ isCompact = false }: OrderSummaryProps) {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const totalSavings = useCartStore((state) => state.totalSavings);

  const shipping = 0; // Free shipping
  const { gstAmount: tax, total } = computeTotals(subtotal());

  if (items.length === 0) {
    return (
      <div className="bg-noir-900 border border-noir-800 p-6 text-center">
        <ShoppingBag className="w-12 h-12 text-ivory-500 mx-auto mb-4" />
        <p className="font-[family-name:var(--font-playfair)] text-lg text-ivory-300 mb-2">
          Your cart is empty
        </p>
        <Link
          href="/"
          className="text-gold-200 font-[family-name:var(--font-jakarta)] text-sm hover:underline"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-noir-900 border border-noir-800">
      {/* Header */}
      <div className="p-6 border-b border-noir-800">
        <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-50">
          Order Summary
        </h3>
        <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mt-1">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Items */}
      <div className={cn(
        'divide-y divide-noir-800',
        isCompact ? 'max-h-64 overflow-y-auto' : ''
      )}>
        {items.map((item) => (
          <div key={item.variantId} className="p-4 flex gap-4">
            {/* Image */}
            <div className="relative w-16 h-20 flex-shrink-0 bg-noir-800">
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
                  <ShoppingBag className="w-6 h-6 text-ivory-500" />
                </div>
              )}
              {/* Quantity Badge */}
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-gold-200 text-noir-950 text-xs font-bold flex items-center justify-center">
                {item.quantity}
              </span>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              {item.artist && (
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-gold-200 uppercase tracking-wider">
                  {item.artist}
                </p>
              )}
              <Link
                href={`/product/${item.productHandle}`}
                className="font-[family-name:var(--font-cormorant)] text-sm text-ivory-100 hover:text-gold-200 line-clamp-2 transition-colors"
              >
                {item.title}
              </Link>
              {item.variantTitle && item.variantTitle !== 'Default Title' && (
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-400 mt-1">
                  {item.variantTitle}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="text-right">
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
                {formatPrice(item.price * item.quantity)}
              </p>
              {isPriceOnSale(item.price, item.compareAtPrice) && (
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-500 line-through">
                  {formatPrice((item.compareAtPrice ?? 0) * item.quantity)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="p-6 border-t border-noir-800 space-y-3">
        <div className="flex justify-between font-[family-name:var(--font-jakarta)] text-sm">
          <span className="text-ivory-400">Subtotal</span>
          <span className="text-ivory-100">{formatPrice(subtotal())}</span>
        </div>

        {totalSavings() > 0 && (
          <div className="flex justify-between font-[family-name:var(--font-jakarta)] text-sm">
            <span className="text-green-400 flex items-center gap-1">
              <Tag size={14} />
              Savings
            </span>
            <span className="text-green-400">-{formatPrice(totalSavings())}</span>
          </div>
        )}

        <div className="flex justify-between font-[family-name:var(--font-jakarta)] text-sm">
          <span className="text-ivory-400">Shipping</span>
          <span className="text-green-400">FREE</span>
        </div>

        <div className="flex justify-between font-[family-name:var(--font-jakarta)] text-sm">
          <span className="text-ivory-400">Tax (18% GST)</span>
          <span className="text-ivory-100">{formatPrice(tax)}</span>
        </div>

        <div className="pt-3 border-t border-noir-700">
          <div className="flex justify-between">
            <span className="font-[family-name:var(--font-playfair)] text-lg text-ivory-50">
              Total
            </span>
            <span className="font-[family-name:var(--font-playfair)] text-lg text-gold-200">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
