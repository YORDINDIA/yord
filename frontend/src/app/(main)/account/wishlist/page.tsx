'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, ShoppingCart, X } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { useWishlistHydrated } from '@/hooks/useHydrated';
import { isPriceOnSale } from '@/lib/product';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { IconButton } from '@/features/ui/IconButton';
import { ProductGridSkeleton } from '@/features/ui/Skeleton';
import { AccountPageHeader } from '../_components/AccountPageHeader';

export default function WishlistPage() {
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
        <AccountPageHeader title="My Wishlist" />
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="My Wishlist"
        action={
          items.length > 0 ? (
            <span className="font-body text-sm text-text-muted">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="bg-surface-card border border-border-default p-12">
          <EmptyState
            title="Your wishlist is empty"
            message="Save items you love by clicking the heart icon on any product."
          >
            <CtaLink href="/" className="gap-2">
              <ShoppingBag size={18} aria-hidden="true" />
              Explore products
            </CtaLink>
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item.productId} className="bg-surface-card border border-border-default group">
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
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                      <ShoppingBag size={24} aria-hidden="true" />
                    </div>
                  )}
                </Link>

                {/* Product Info */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    {item.artist && (
                      <p className="font-body text-xs text-accent uppercase tracking-wider mb-1">
                        {item.artist}
                      </p>
                    )}
                    <Link
                      href={`/product/${item.productHandle}`}
                      className="font-body text-sm text-text-secondary hover:text-accent transition-colors line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-accent text-lg text-accent">
                        {formatPrice(item.price)}
                      </span>
                      {isPriceOnSale(item.price, item.compareAtPrice) && (
                        <span className="font-body text-sm text-text-muted line-through">
                          {formatPrice(item.compareAtPrice ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {/* Size choice lives on the product page, so this is a link
                        to it — it was a `<button>` that called `router.push`,
                        which a screen reader cannot announce as navigation. */}
                    <CtaLink
                      href={`/product/${item.productHandle}`}
                      className="flex-1 gap-2"
                    >
                      <ShoppingCart size={14} aria-hidden="true" />
                      Select options
                    </CtaLink>
                    <IconButton
                      label={`Remove ${item.title} from wishlist`}
                      variant="outline"
                      onClick={() => removeItem(item.productId)}
                      className="hover:text-danger hover:border-danger/50"
                    >
                      <X size={16} aria-hidden="true" />
                    </IconButton>
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
