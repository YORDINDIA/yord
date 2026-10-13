'use client';

import { forwardRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Heart, Images, Eye } from 'lucide-react';
import { cn, formatPrice } from '@yord/ui';
import { getDiscountPercentage, isPriceOnSale } from '@/lib/product';
import { ArrowDiag } from './Glyphs';
import {
  normalizeCardProps,
  toCartItem,
  type ProductCardProps,
} from '@/features/product/cardModel';
import type { ProductVariant } from '@yord/db-types';
import { useCartStore } from '@/lib/stores/cartStore';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import './product-card.css';

// The prop shapes live with the model that normalizes them; re-exported here so
// callers keep importing them from the card.
export type {
  ProductCardProps,
  ProductCardSimpleProps,
  ProductCardWithDataProps,
} from '@/features/product/cardModel';

const QuickViewModal = dynamic(
  () => import('@/features/product/QuickViewModal').then((mod) => mod.QuickViewModal),
  { ssr: false }
);

/**
 * The grid card.
 *
 * Not an anchor wrapping the whole card: the wishlist, quick-view, alternate
 * image and add-to-bag controls are real buttons, and `<button>` inside `<a>`
 * is invalid HTML that only worked because every handler called
 * `preventDefault`. Instead the title link carries `after:inset-0`, a stretched
 * hit area over the card, and the controls are siblings above it.
 *
 * The text block reserves its own height so the price rows line up across a
 * grid row — a one-line title next to a two-line one used to leave the prices
 * ragged — and the add-to-bag bar is always visible rather than a
 * hover-reveal, because it is the card's primary action.
 *
 * The card does not lift or cast a shadow on hover: the image swaps to the
 * alternate view and the title takes the accent. At most one status label sits
 * on the photo; the discount lives in the price row.
 */
const ProductCard = forwardRef<HTMLDivElement, ProductCardProps>(
  (props, ref) => {
    const [imageError, setImageError] = useState(false);
    const [showAlternate, setShowAlternate] = useState(false);
    const [showQuickView, setShowQuickView] = useState(false);
    const addItem = useCartStore((state) => state.addItem);
    const toggleWishlist = useWishlistStore((state) => state.toggleItem);
    const wishlistItems = useWishlistStore((state) => state.items);

    const card = normalizeCardProps(props);
    const {
      handle,
      title,
      artist,
      price,
      compareAtPrice,
      primaryImageUrl,
      secondaryImageUrl,
      badge,
      inStock,
      priority,
      className,
      product,
      productId,
    } = card;

    const cartItem = toCartItem(card);
    const canAdd = product !== undefined || cartItem !== null;

    const handleAddToCart = () => {
      if (!inStock) return;
      // Full product data: open quick view so the shopper picks a size.
      if (product) {
        setShowQuickView(true);
        return;
      }
      // ID-fallback cards (related products) carry only the cheapest variant's
      // metadata, so there is no size choice to make.
      if (cartItem) addItem(cartItem, 1);
    };

    const handleToggleWishlist = () => {
      if (productId === null) return;
      toggleWishlist({
        productId,
        productHandle: handle,
        title,
        price,
        compareAtPrice,
        image: primaryImageUrl || '',
        artist,
      });
    };

    const isWishlisted =
      productId !== null && wishlistItems.some((i) => i.productId === productId);

    // Calculate sale info (Number-safe: DECIMAL arrives as string at runtime)
    const onSale = isPriceOnSale(price, compareAtPrice);
    const discount = getDiscountPercentage(
      { price, compare_at_price: compareAtPrice } as unknown as ProductVariant
    );
    // One status on the photo, most urgent first. A low-stock LIMITED badge
    // gets a real count when the full row is here; a tagged one reads as an
    // edition.
    const unitsLeft = product
      ? product.product_variants.reduce((n, v) => n + Math.max(0, v.inventory_quantity), 0)
      : null;
    const status = !inStock
      ? 'Sold out'
      : badge === 'LIMITED'
        ? unitsLeft !== null && unitsLeft > 0 && unitsLeft <= 5
          ? `Only ${unitsLeft} left`
          : 'Limited edition'
        : badge === 'NEW'
          ? 'New'
          : null;
    const note = badge === 'BESTSELLER' ? 'Bestseller' : badge === 'TRENDING' ? 'Trending' : null;

    // Only the visible layer is animated: the two states are mutually
    // exclusive so no two `opacity-*` utilities ever fight.
    const primaryOpacity = showAlternate ? 'opacity-0' : 'opacity-100';
    const secondaryVisible = showAlternate ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
    // The mobile grid is 2 columns, so `100vw` would ask for a 2x file on phones.
    const sizes = '(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw';

    return (
      <div ref={ref} className={cn('pc group relative', className)} data-cursor="pointer">
        {/* The controls sit outside the clipped frame: its clip-path is a
            stacking context, which would trap them under the title link's
            card-wide hit area. */}
        <div className="relative">
          <div className="pc-frame">
            <div className="pc-frame__in">
              {primaryImageUrl && !imageError ? (
                <>
                  <Image
                    src={primaryImageUrl}
                    alt={title}
                    fill
                    sizes={sizes}
                    priority={priority}
                    className={cn(
                      'object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none',
                      primaryOpacity,
                      // Hover only swaps when there is a second image to swap to,
                      // and never while the shopper has pinned the alternate one.
                      secondaryImageUrl && !showAlternate && 'group-hover:opacity-0'
                    )}
                    onError={() => setImageError(true)}
                  />
                  {secondaryImageUrl && (
                    <Image
                      src={secondaryImageUrl}
                      alt={`${title}, alternate view`}
                      fill
                      sizes={sizes}
                      className={cn(
                        'object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none',
                        secondaryVisible
                      )}
                    />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-body text-sm text-text-muted">No image</span>
                </div>
              )}

              {status && (
                <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 bg-scrim text-text-on-media font-body text-xs font-medium leading-none">
                  {status}
                </span>
              )}
            </div>
          </div>
          {/* Controls are siblings of the title link, above its hit area. */}
          <div className="absolute top-1 right-1 z-20 flex flex-col">
            {/* No id, nothing to save: a heart that does nothing is a dead control. */}
            {productId !== null && (
              <button
                type="button"
                className="pc-act"
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-pressed={isWishlisted}
                onClick={handleToggleWishlist}
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            )}
            {product && (
              <button
                type="button"
                className="pc-act"
                aria-label="Quick view"
                onClick={() => setShowQuickView(true)}
              >
                <Eye size={20} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Alternate-image toggle: the hover swap has no touch equivalent. */}
          {secondaryImageUrl && (
            <button
              type="button"
              className="pc-act absolute bottom-1 right-1 z-20"
              aria-label={showAlternate ? 'Show first image' : 'Show alternate image'}
              aria-pressed={showAlternate}
              onClick={() => setShowAlternate((v) => !v)}
            >
              <Images size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Product info: fixed heights keep the price row level across a row. */}
        <div className="pt-4">
          <p className="h-5 truncate font-body text-sm text-text-muted">
            {[artist, note].filter(Boolean).join(' · ')}
          </p>

          <h3 className="mt-1 min-h-[3.1rem] font-heading text-lg leading-snug text-text-primary group-hover:text-accent transition-colors duration-300 line-clamp-2">
            <Link
              href={`/product/${handle}`}
              className="focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring after:absolute after:inset-0 after:z-10"
            >
              {title}
            </Link>
          </h3>

          <p className="mt-2 flex items-baseline gap-x-2.5 tabular-nums">
            <span className="font-display-alt text-xl font-bold text-text-primary">{formatPrice(price)}</span>
            {onSale && compareAtPrice && (
              <>
                <span className="font-body text-sm text-text-muted line-through">
                  {formatPrice(compareAtPrice)}
                </span>
                <span className="font-body text-sm font-semibold text-accent">−{discount}%</span>
              </>
            )}
          </p>

          {canAdd && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock}
              className="pc-cta relative z-20 mt-3 flex w-full items-center justify-between gap-3 px-4 py-3 bg-accent-tint text-text-primary font-body text-sm font-semibold transition-colors hover:bg-accent hover:text-text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-text-muted"
            >
              {!inStock ? 'Sold out' : product ? 'View options' : 'Add to bag'}
              {inStock && <ArrowDiag className="pc-cta__arrow" />}
            </button>
          )}
        </div>

        {product && showQuickView && (
          <QuickViewModal
            product={product}
            isOpen={showQuickView}
            onClose={() => setShowQuickView(false)}
          />
        )}
      </div>
    );
  }
);

ProductCard.displayName = 'ProductCard';

export { ProductCard };
