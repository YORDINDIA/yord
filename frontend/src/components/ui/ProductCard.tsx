'use client';

import { forwardRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatPrice,
  getDiscountPercentage,
  getFirstByPosition,
  getImageUrl,
  getLowestPriceVariant,
  getPrimaryImage,
  getProductBadge,
  getSecondaryImage,
  isInStock,
  isPriceOnSale,
} from '@/lib/utils';
import { SaleBadge, LimitedBadge, SoldOutBadge, ArtistBadge, Badge } from './Badge';
import type { ProductVariant, ProductWithDetails, CartItem } from '@/types/database';
import { ARTISTS, vendorToHandle } from '@/types/database';
import { useCartStore } from '@/lib/stores/cartStore';
import { useWishlistStore } from '@/lib/stores/wishlistStore';

const QuickViewModal = dynamic(
  () => import('@/components/product/QuickViewModal').then((mod) => mod.QuickViewModal),
  { ssr: false }
);

// Props for when using full product data from Supabase
export interface ProductCardWithDataProps {
  product: ProductWithDetails;
  priority?: boolean;
  className?: string;
}

// Simplified props for static/mock data
export interface ProductCardSimpleProps {
  handle: string;
  title: string;
  artist?: string;
  price: number;
  compareAtPrice?: number | null;
  image?: string | null;
  imageSrc?: string; // Alternative prop name for image
  imageAlt?: string;
  secondaryImage?: string | null;
  badge?: 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;
  accentColor?: string;
  inStock?: boolean;
  priority?: boolean;
  className?: string;
  // Optional full product data for cart functionality
  product?: ProductWithDetails;
  // Optional ids for wishlist/cart when full product data is unavailable
  // (e.g. related-product cards that only fetch a subset of columns)
  productId?: number;
  variantId?: number | null;
  variantTitle?: string | null;
  maxQuantity?: number;
}

export type ProductCardProps = ProductCardWithDataProps | ProductCardSimpleProps;

function isSimpleProps(props: ProductCardProps): props is ProductCardSimpleProps {
  return 'handle' in props;
}

const ProductCard = forwardRef<HTMLDivElement, ProductCardProps>(
  (props, ref) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showQuickView, setShowQuickView] = useState(false);
    const addItem = useCartStore((state) => state.addItem);
    const toggleWishlist = useWishlistStore((state) => state.toggleItem);
    const wishlistItems = useWishlistStore((state) => state.items);

    // Normalize props to a common format
    const isSimple = isSimpleProps(props);

    let handle: string;
    let title: string;
    let artist: string | null | undefined;
    let price: number;
    let compareAtPrice: number | null | undefined;
    let primaryImageUrl: string | null;
    let secondaryImageUrl: string | null;
    let badgeType: 'NEW' | 'SALE' | 'LIMITED' | 'BESTSELLER' | 'TRENDING' | null;
    let inStock: boolean;
    let priority: boolean;
    let className: string | undefined;
    // Cart-related data
    let productData: ProductWithDetails | undefined;
    let variantId: number | null = null;
    let productId: number | null = null;
    let variantTitle: string | null = null;
    let maxQuantity: number = 10;

    if (isSimple) {
      handle = props.handle;
      title = props.title;
      artist = props.artist;
      price = props.price;
      compareAtPrice = props.compareAtPrice;
      primaryImageUrl = props.imageSrc || props.image || null;
      secondaryImageUrl = props.secondaryImage || null;
      badgeType = props.badge || null;
      inStock = props.inStock !== false;
      priority = props.priority ?? false;
      className = props.className;
      productData = props.product;

      // Extract variant data from product if available
      if (productData) {
        const variant = getFirstByPosition(productData.product_variants);
        if (variant) {
          variantId = variant.id;
          productId = productData.id;
          variantTitle = variant.title;
          maxQuantity = variant.inventory_quantity > 0 ? variant.inventory_quantity : 10;
        }
      } else if (props.productId != null) {
        productId = props.productId;
        variantId = props.variantId ?? null;
        variantTitle = props.variantTitle ?? null;
        maxQuantity = props.maxQuantity ?? 10;
      }
    } else {
      const product = props.product;
      productData = product;
      const primaryImage = getPrimaryImage(product.product_images);
      const secondaryImage = getSecondaryImage(product.product_images);
      const lowestVariant = getLowestPriceVariant(product.product_variants);

      handle = product.handle;
      title = product.title;
      artist = product.vendor;
      price = lowestVariant?.price ?? 0;
      compareAtPrice = lowestVariant?.compare_at_price;
      primaryImageUrl = primaryImage ? getImageUrl(primaryImage) : null;
      secondaryImageUrl = secondaryImage ? getImageUrl(secondaryImage) : null;
      badgeType = getProductBadge(product, lowestVariant);
      inStock = isInStock(product);
      priority = props.priority ?? false;
      className = props.className;

      // Extract cart data from product
      if (lowestVariant) {
        variantId = lowestVariant.id;
        productId = product.id;
        variantTitle = lowestVariant.title;
        maxQuantity = lowestVariant.inventory_quantity > 0 ? lowestVariant.inventory_quantity : 10;
      }
    }

    // Handle add to cart - always opens quick view for size selection
    const handleAddToCart = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!inStock) return;

      // Always open quick view to let user select size
      if (productData) {
        setShowQuickView(true);
      }
    };

    // Handle wishlist toggle
    const handleToggleWishlist = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (productId === null) return;

      toggleWishlist({
        productId,
        productHandle: handle,
        title,
        price,
        compareAtPrice: compareAtPrice ?? null,
        image: primaryImageUrl || '',
        artist: artist ?? null,
      });
    };

    // Check if product is in wishlist (subscribes to items so the heart re-renders)
    const isWishlisted =
      productId !== null && wishlistItems.some((i) => i.productId === productId);

    // Calculate sale info (Number-safe: DECIMAL arrives as string at runtime)
    const onSale = isPriceOnSale(price, compareAtPrice);
    const discount = getDiscountPercentage(
      { price, compare_at_price: compareAtPrice } as unknown as ProductVariant
    );
    const isLimited = badgeType === 'LIMITED';

    // Get artist accent color
    const artistHandle = artist ? vendorToHandle(artist) : null;
    const artistData = artistHandle ? ARTISTS[artistHandle] : null;
    const accentColor = isSimple && props.accentColor ? props.accentColor : artistData?.accentColor;

    return (
      <motion.div
        ref={ref}
        className={cn('group relative transition-shadow duration-300 hover:-translate-y-2 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_16px_rgba(0,0,0,0.15),0_16px_32px_rgba(0,0,0,0.2),0_32px_64px_rgba(0,0,0,0.1)] shadow-[0_2px_8px_rgba(0,0,0,0.1)]', className)}
        data-cursor="pointer"
      >
        <Link href={`/product/${handle}`} className="block">
          {/* Image Container */}
          <div className="relative aspect-[3/4] overflow-hidden bg-noir-900">
            {/* Primary Image with blur-to-sharp reveal */}
            {primaryImageUrl && !imageError ? (
              <motion.div
                className="absolute inset-0"
                initial={{ filter: 'blur(8px)', scale: 1.05 }}
                animate={imageLoaded ? { filter: 'blur(0px)', scale: 1 } : {}}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <Image
                  src={primaryImageUrl}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className={cn(
                    'object-cover transition-all duration-700 ease-out',
                    secondaryImageUrl ? 'group-hover:opacity-0 group-hover:scale-105 opacity-100 scale-100' : 'opacity-100 scale-100'
                  )}
                  priority={priority}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-noir-800">
                <span className="text-ivory-400 text-sm">No Image</span>
              </div>
            )}

            {/* Secondary Image (hover) */}
            {secondaryImageUrl && !imageError && (
              <Image
                src={secondaryImageUrl}
                alt={`${title} - alternate view`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className={cn(
                  'object-cover transition-all duration-700 ease-out opacity-0 scale-105 group-hover:opacity-100 group-hover:scale-100'
                )}
              />
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-noir-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {!inStock && <SoldOutBadge />}
              {inStock && onSale && <SaleBadge discount={discount} />}
              {inStock && isLimited && <LimitedBadge />}
              {inStock && badgeType === 'NEW' && <Badge variant="new">NEW</Badge>}
              {inStock && badgeType === 'BESTSELLER' && <Badge variant="default">BESTSELLER</Badge>}
              {inStock && badgeType === 'TRENDING' && <Badge variant="default">TRENDING</Badge>}
            </div>

            {/* Quick Actions */}
            <div
              className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto max-md:opacity-100 max-md:pointer-events-auto"
            >
              <button
                onClick={handleToggleWishlist}
                className={cn(
                  'w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-colors duration-200',
                  isWishlisted
                    ? 'bg-gold-200 text-noir-950'
                    : 'bg-noir-900/80 text-ivory-100 hover:bg-gold-200 hover:text-noir-950'
                )}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
              {productData && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowQuickView(true);
                  }}
                  className="w-10 h-10 flex items-center justify-center bg-noir-900/80 backdrop-blur-sm text-ivory-100 hover:bg-gold-200 hover:text-noir-950 transition-colors duration-200"
                  aria-label="Quick view"
                >
                  <Eye size={18} />
                </button>
              )}
            </div>

            {/* Add to Cart Button (Mobile: visible, Desktop: on hover) */}
            <div
              className="absolute bottom-0 left-0 right-0 p-4 opacity-0 translate-y-5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto max-md:opacity-100 max-md:translate-y-0 max-md:pointer-events-auto"
            >
              <button
                onClick={handleAddToCart}
                disabled={!inStock}
                className={cn(
                  'w-full py-3 flex items-center justify-center gap-2',
                  'font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] uppercase',
                  'transition-all duration-300',
                  inStock
                    ? 'bg-gold-200 text-noir-950 hover:bg-gold-300'
                    : 'bg-noir-700 text-ivory-400 cursor-not-allowed'
                )}
              >
                <ShoppingBag size={16} />
                {!inStock ? 'SOLD OUT' : 'VIEW OPTIONS'}
              </button>
            </div>

            {/* Artist Accent Border (on hover) */}
            {accentColor && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </div>

          {/* Product Info */}
          <div className="pt-4 space-y-2">
            {/* Artist Badge */}
            {artist && (
              <ArtistBadge artist={artist} color={accentColor} />
            )}

            {/* Title */}
            <h3 className="font-[family-name:var(--font-cormorant)] text-lg text-ivory-50 group-hover:text-gold-200 transition-colors duration-300 line-clamp-2">
              {title}
            </h3>

            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-jakarta)] text-ivory-50 font-medium">
                {formatPrice(price)}
              </span>
              {onSale && compareAtPrice && (
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-sm line-through">
                  {formatPrice(compareAtPrice)}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Quick View Modal */}
        {productData && showQuickView && (
          <QuickViewModal
            product={productData}
            isOpen={showQuickView}
            onClose={() => setShowQuickView(false)}
          />
        )}
      </motion.div>
    );
  }
);

ProductCard.displayName = 'ProductCard';

export { ProductCard };
