'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, ShoppingBag, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice, getFirstByPosition, getImageUrl, isPriceOnSale, sortByPosition } from '@/lib/utils';
import type { ProductWithDetails, ProductVariant } from '@/types/database';
import { useCartStore } from '@/lib/stores/cartStore';
import { useWishlistStore } from '@/lib/stores/wishlistStore';

interface QuickViewModalProps {
  product: ProductWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const firstVariant = (p: ProductWithDetails): ProductVariant | null => {
    return getFirstByPosition(p.product_variants);
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => firstVariant(product)
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Re-sync when a different product is shown (render-phase update).
  const [prevProduct, setPrevProduct] = useState(product);
  if (prevProduct !== product) {
    setPrevProduct(product);
    setSelectedVariant(firstVariant(product));
    setCurrentImageIndex(0);
    setQuantity(1);
  }

  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);

  const selectVariant = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setQuantity(1);
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent body scroll when modal is open
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

  const sortedImages = sortByPosition(product.product_images);

  const currentImage = sortedImages[currentImageIndex];
  const imageUrl = currentImage ? getImageUrl(currentImage) : null;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productHandle: product.handle,
      title: product.title,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compare_at_price,
      image: imageUrl,
      maxQuantity: selectedVariant.inventory_quantity > 0 ? selectedVariant.inventory_quantity : 10,
      artist: product.vendor,
    }, quantity);

    onClose();
  };

  const handleToggleWishlist = () => {
    toggleWishlist({
      productId: product.id,
      productHandle: product.handle,
      title: product.title,
      price: selectedVariant?.price || 0,
      compareAtPrice: selectedVariant?.compare_at_price || null,
      image: imageUrl || '',
      artist: product.vendor,
    });
  };

  const isWishlisted = useWishlistStore((state) =>
    state.items.some((i) => i.productId === product.id)
  );
  const inStock = selectedVariant ? selectedVariant.inventory_quantity > 0 : false;
  const onSale = isPriceOnSale(selectedVariant?.price, selectedVariant?.compare_at_price);

  // Group variants by option
  const uniqueOptions: Record<string, string[]> = {};
  product.product_variants?.forEach((variant) => {
    if (variant.option1 && !uniqueOptions['option1']?.includes(variant.option1)) {
      uniqueOptions['option1'] = uniqueOptions['option1'] || [];
      uniqueOptions['option1'].push(variant.option1);
    }
  });

  const optionName = product.product_options?.[0]?.name || 'Size';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-noir-950/90 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[900px] md:max-h-[80vh] bg-noir-900 border border-noir-800 z-[101] overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-noir-800/80 hover:bg-noir-700 text-ivory-100 transition-colors"
              aria-label="Close quick view"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
              {/* Image Section */}
              <div className="relative w-full md:w-1/2 aspect-square md:aspect-auto md:h-full bg-noir-800">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 450px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-ivory-400">No Image</span>
                  </div>
                )}

                {/* Image Navigation */}
                {sortedImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-noir-900/80 hover:bg-noir-800 text-ivory-100 transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-noir-900/80 hover:bg-noir-800 text-ivory-100 transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight size={20} />
                    </button>

                    {/* Image Dots */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {sortedImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={cn(
                            'w-2 h-2 rounded-full transition-colors',
                            idx === currentImageIndex ? 'bg-gold-200' : 'bg-ivory-400/50'
                          )}
                          aria-label={`View image ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Details Section */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col md:overflow-y-auto">
                {/* Artist */}
                {product.vendor && (
                  <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] text-gold-200 mb-2">
                    {product.vendor.toUpperCase()}
                  </p>
                )}

                {/* Title */}
                <h2 className="font-[family-name:var(--font-playfair)] text-2xl md:text-3xl text-ivory-50 mb-4">
                  {product.title}
                </h2>

                {/* Price */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50">
                    {formatPrice(selectedVariant?.price || 0)}
                  </span>
                  {onSale && selectedVariant?.compare_at_price && (
                    <span className="font-[family-name:var(--font-jakarta)] text-lg text-ivory-400 line-through">
                      {formatPrice(selectedVariant.compare_at_price)}
                    </span>
                  )}
                </div>

                {/* Variant Selector */}
                {product.product_variants && product.product_variants.length > 1 && (
                  <div className="mb-6">
                    <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-3">
                      {optionName.toUpperCase()}: <span className="text-ivory-100">{selectedVariant?.option1}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.product_variants
                        .sort((a, b) => a.position - b.position)
                        .map((variant) => {
                          const isSelected = selectedVariant?.id === variant.id;
                          const isAvailable = variant.inventory_quantity > 0;
                          return (
                            <button
                              key={variant.id}
                              onClick={() => selectVariant(variant)}
                              disabled={!isAvailable}
                              className={cn(
                                'px-4 py-2 border text-sm font-[family-name:var(--font-jakarta)] transition-colors',
                                isSelected
                                  ? 'border-gold-200 bg-gold-200/10 text-gold-200'
                                  : isAvailable
                                  ? 'border-noir-700 text-ivory-300 hover:border-ivory-400'
                                  : 'border-noir-800 text-ivory-600 cursor-not-allowed line-through'
                              )}
                            >
                              {variant.option1 || variant.title}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-6">
                  <p className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-3">
                    QUANTITY
                  </p>
                  <div className="flex items-center border border-noir-700 w-fit">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center text-ivory-300 hover:text-ivory-100 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-[family-name:var(--font-jakarta)] text-ivory-100">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(selectedVariant?.inventory_quantity || 10, q + 1))}
                      className="w-10 h-10 flex items-center justify-center text-ivory-300 hover:text-ivory-100 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    className={cn(
                      'flex-1 py-4 flex items-center justify-center gap-2',
                      'font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em]',
                      'transition-colors',
                      inStock
                        ? 'bg-gold-200 text-noir-950 hover:bg-gold-300'
                        : 'bg-noir-700 text-ivory-400 cursor-not-allowed'
                    )}
                  >
                    <ShoppingBag size={18} />
                    {inStock ? 'ADD TO BAG' : 'SOLD OUT'}
                  </button>
                  <button
                    onClick={handleToggleWishlist}
                    className={cn(
                      'w-14 h-14 flex items-center justify-center border transition-colors',
                      isWishlisted
                        ? 'border-gold-200 bg-gold-200/10 text-gold-200'
                        : 'border-noir-700 text-ivory-300 hover:border-ivory-400'
                    )}
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {/* View Full Details Link */}
                <Link
                  href={`/product/${product.handle}`}
                  onClick={onClose}
                  className="mt-4 text-center font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 hover:text-gold-200 transition-colors"
                >
                  View Full Details
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
