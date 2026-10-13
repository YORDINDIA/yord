'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ShoppingBag, X } from 'lucide-react';
import { cn } from '@yord/ui';
import { formatPrice } from '@yord/ui';
import { getFirstByPosition, getImageUrl, isPriceOnSale, sortByPosition } from '@/lib/product';
import type { ProductWithDetails, ProductVariant } from '@yord/db-types';
import { useCartStore } from '@/lib/stores/cartStore';
import { Overlay } from '@/features/ui/Overlay';
import { Button } from '@/features/ui/Button';
import { IconButton } from '@/features/ui/IconButton';
import { WishlistButton } from './WishlistButton';
import { QuantityStepper } from './QuantityStepper';
import { VariantPicker, type VariantChoice } from './VariantPicker';
import { maxQuantityFor } from './cartItem';

interface QuickViewModalProps {
  product: ProductWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Size + add-to-bag without leaving the grid.
 *
 * Rendered inside the shared `Overlay`, which owns the portal, backdrop,
 * focus trap, Escape handling and body scroll lock — the four hand-rolled
 * copies in the app had already drifted (only some locked scroll, none trapped
 * Tab), so this one no longer carries its own.
 */
export function QuickViewModal({ product, isOpen, onClose }: QuickViewModalProps) {
  const titleId = useId();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => getFirstByPosition(product.product_variants)
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Re-sync when a different product is shown (render-phase update).
  const [prevProduct, setPrevProduct] = useState(product);
  if (prevProduct !== product) {
    setPrevProduct(product);
    setSelectedVariant(getFirstByPosition(product.product_variants));
    setCurrentImageIndex(0);
    setQuantity(1);
  }

  const addItem = useCartStore((state) => state.addItem);

  const sortedImages = sortByPosition(product.product_images);
  const currentImage = sortedImages[currentImageIndex];
  const imageUrl = currentImage ? getImageUrl(currentImage) : null;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));
  };

  const maxQuantity = maxQuantityFor(selectedVariant?.inventory_quantity);

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productHandle: product.handle ?? '',
      title: product.title,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compare_at_price,
      image: imageUrl,
      maxQuantity,
      artist: product.vendor,
    }, quantity);

    onClose();
  };

  const inStock = selectedVariant ? selectedVariant.inventory_quantity > 0 : false;
  const onSale = isPriceOnSale(selectedVariant?.price, selectedVariant?.compare_at_price);
  const optionName = product.product_options?.[0]?.name || 'Size';

  // Position order, the same as the PDP: sorting by id in one surface and by
  // position in the other showed the same product's sizes in two orders.
  const choices: VariantChoice[] = sortByPosition(product.product_variants).map((variant) => ({
    id: variant.id,
    label: variant.option1 || variant.title || 'Default',
    available: variant.inventory_quantity > 0,
  }));

  const handleSelectVariant = (id: number) => {
    const variant = product.product_variants.find((v) => v.id === id);
    if (variant) {
      setSelectedVariant(variant);
      setQuantity(1);
    }
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      className="md:w-[900px] md:max-w-[900px] md:max-h-[85vh]"
    >
      {/* The translucent surface lives on the wrapper: a `bg-*` in the
          button's own className would race the variant's background. */}
      <div className="absolute top-4 right-4 z-10 bg-surface-raised/80">
        <IconButton label="Close quick view" variant="ghost" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Image Section */}
        <div className="relative w-full md:w-1/2 aspect-square md:aspect-[3/4] bg-surface-raised shrink-0">
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
              <span className="text-text-muted">No Image</span>
            </div>
          )}

          {/* Image Navigation */}
          {sortedImages.length > 1 && (
            <>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-surface-card/80">
                <IconButton label="Previous image" variant="ghost" onClick={handlePrevImage}>
                  <ChevronLeft size={20} />
                </IconButton>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-surface-card/80">
                <IconButton label="Next image" variant="ghost" onClick={handleNextImage}>
                  <ChevronRight size={20} />
                </IconButton>
              </div>

              {/* Image Dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                {sortedImages.map((_, idx) => (
                  <IconButton
                    key={idx}
                    label={`View image ${idx + 1}`}
                    variant="ghost"
                    size="sm"
                    aria-current={idx === currentImageIndex ? 'true' : undefined}
                    onClick={() => setCurrentImageIndex(idx)}
                    className="rounded-full"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block w-2 h-2 rounded-full transition-colors',
                        idx === currentImageIndex ? 'bg-accent' : 'bg-text-muted/50'
                      )}
                    />
                  </IconButton>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Details Section */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
          {/* Artist */}
          {product.vendor && (
            <p className="font-accent text-xs tracking-[0.2em] text-accent mb-2">
              {product.vendor.toUpperCase()}
            </p>
          )}

          {/* Title */}
          <h2 id={titleId} className="font-display text-2xl md:text-3xl text-text-primary mb-4">
            {product.title}
          </h2>

          {/* Price */}
          <div className="flex items-center gap-3 mb-6">
            <span className="font-heading text-2xl text-text-primary">
              {formatPrice(selectedVariant?.price || 0)}
            </span>
            {onSale && selectedVariant?.compare_at_price && (
              <span className="font-body text-lg text-text-muted line-through">
                {formatPrice(selectedVariant.compare_at_price)}
              </span>
            )}
          </div>

          {/* Variant Selector */}
          {choices.length > 1 && (
            <div className="mb-6">
              <VariantPicker
                label={optionName}
                name={`quick-view-variant-${product.id}`}
                choices={choices}
                selectedId={selectedVariant?.id ?? null}
                onSelect={handleSelectVariant}
              />
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <p className="font-accent text-xs tracking-[0.1em] text-text-muted mb-3">
              QUANTITY
            </p>
            <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <Button
              onClick={handleAddToCart}
              disabled={!inStock}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {inStock ? 'ADD TO BAG' : 'SOLD OUT'}
            </Button>
            <WishlistButton
              variant="boxed"
              size="lg"
              productId={product.id}
              productHandle={product.handle ?? ''}
              title={product.title}
              price={selectedVariant?.price || 0}
              compareAtPrice={selectedVariant?.compare_at_price || null}
              image={imageUrl || ''}
              artist={product.vendor}
            />
          </div>

          {/* View Full Details Link */}
          <Link
            href={`/product/${product.handle}`}
            onClick={onClose}
            className="mt-4 text-center font-body text-sm text-text-muted hover:text-accent transition-colors"
          >
            View Full Details
          </Link>
        </div>
      </div>
    </Overlay>
  );
}
