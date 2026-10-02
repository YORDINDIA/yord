'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, X, ShoppingCart } from 'lucide-react';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { useWishlistHydrated } from '@/hooks/useHydrated';
import { ProductGridSkeleton } from '@/features/ui/Skeleton';
import { formatPrice } from '@yord/ui';
import { isPriceOnSale } from '@/lib/product';

export default function WishlistPage() {
  const router = useRouter();
  const hydrated = useWishlistHydrated();
  const items = useWishlistStore((state) => state.items);
  const removeItem = useWishlistStore((state) => state.removeItem);
  // Persisted storage can be unavailable (private mode, blocked
  // localStorage) so `_hasHydrated` may never flip. Stop skeletoning after
  // a grace period and render the usable fallback (empty state with a
  // shopping CTA) instead of hanging forever.
  const [hydrateTimedOut, setHydrateTimedOut] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const t = setTimeout(() => setHydrateTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [hydrated]);

  // Pre-hydration `items` is the store default (`[]`), not the real
  // wishlist — skeleton instead of a flashing "empty" state.
  if (!hydrated && !hydrateTimedOut) {
    return (
      <div className="space-y-6">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary">
          My Wishlist
        </h2>
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  const handleViewProduct = (item: typeof items[0]) => {
    // Navigate to product page where user can select size/variant
    router.push(`/product/${item.productHandle}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary">
          My Wishlist
        </h2>
        {items.length > 0 && (
          <span className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-surface-card border border-border-default p-12 text-center">
          <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-xl text-text-secondary mb-2">
            Your wishlist is empty
          </h3>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted mb-6">
            Save items you love by clicking the heart icon on any product.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
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
              className="bg-surface-card border border-border-default group"
            >
              <div className="flex">
                {/* Product Image */}
                <Link
                  href={`/product/${item.productHandle}`}
                  className="relative w-32 h-32 flex-shrink-0 bg-surface-raised"
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                </Link>

                {/* Product Info */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    {item.artist && (
                      <p className="font-[family-name:var(--font-jakarta)] text-xs text-accent uppercase tracking-wider mb-1">
                        {item.artist}
                      </p>
                    )}
                    <Link
                      href={`/product/${item.productHandle}`}
                      className="font-[family-name:var(--font-jakarta)] text-sm text-text-secondary hover:text-accent transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-[family-name:var(--font-bebas)] text-lg text-accent">
                        {formatPrice(item.price)}
                      </span>
                      {isPriceOnSale(item.price, item.compareAtPrice) && (
                        <span className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted line-through">
                          {formatPrice(item.compareAtPrice ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleViewProduct(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-xs tracking-wider hover:bg-accent-hover transition-colors"
                    >
                      <ShoppingCart size={14} />
                      SELECT OPTIONS
                    </button>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="w-8 h-8 flex items-center justify-center border border-border-default text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors"
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
