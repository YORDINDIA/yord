'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, X, ShoppingCart, ExternalLink } from 'lucide-react';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { formatPrice, isPriceOnSale } from '@/lib/utils';

export default function WishlistPage() {
  const router = useRouter();
  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);

  const handleViewProduct = (item: typeof items[0]) => {
    // Navigate to product page where user can select size/variant
    router.push(`/product/${item.productHandle}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50">
          My Wishlist
        </h2>
        {items.length > 0 && (
          <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-noir-900 border border-noir-800 p-12 text-center">
          <div className="w-16 h-16 bg-noir-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-8 h-8 text-ivory-500" />
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-100 mb-2">
            Your wishlist is empty
          </h3>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-6">
            Save items you love by clicking the heart icon on any product.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
          >
            <ShoppingBag size={18} />
            EXPLORE PRODUCTS
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.productId}
              className="bg-noir-900 border border-noir-800 group"
            >
              <div className="flex">
                {/* Product Image */}
                <Link
                  href={`/product/${item.productHandle}`}
                  className="relative w-32 h-32 flex-shrink-0 bg-noir-800"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ivory-600">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </Link>

                {/* Product Info */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    {item.artist && (
                      <p className="font-[family-name:var(--font-jakarta)] text-xs text-gold-200 uppercase tracking-wider mb-1">
                        {item.artist}
                      </p>
                    )}
                    <Link
                      href={`/product/${item.productHandle}`}
                      className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100 hover:text-gold-200 transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-[family-name:var(--font-bebas)] text-lg text-gold-200">
                        {formatPrice(item.price)}
                      </span>
                      {isPriceOnSale(item.price, item.compareAtPrice) && (
                        <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-500 line-through">
                          {formatPrice(item.compareAtPrice ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleViewProduct(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-xs tracking-wider hover:bg-gold-300 transition-colors"
                    >
                      <ShoppingCart size={14} />
                      SELECT OPTIONS
                    </button>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="w-8 h-8 flex items-center justify-center border border-noir-700 text-ivory-400 hover:text-red-400 hover:border-red-400/50 transition-colors"
                      aria-label="Remove from wishlist"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
