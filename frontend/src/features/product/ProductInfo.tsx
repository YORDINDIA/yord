'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Share2, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@yord/ui';
import { isPriceOnSale, sortByPosition } from '@/lib/product';
import { useCartStore } from '@/lib/stores/cartStore';
import { Button } from '@/features/ui/Button';
import { IconButton } from '@/features/ui/IconButton';
import { Reveal } from '@/features/ui/Reveal';
import { SaleBadge } from '@/features/ui/Badge';
import { TrustBadges } from '@/features/ui/TrustBadges';
import { WishlistButton } from './WishlistButton';
import { QuantityStepper } from './QuantityStepper';
import { VariantPicker, type VariantChoice } from './VariantPicker';
import { maxQuantityFor } from './cartItem';
import { ARTISTS } from '@yord/db-types';

interface ProductVariant {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  option1: string;
  /** Shopify/admin display order; the picker and quick view both sort on it. */
  position: number;
}

interface ProductInfoProps {
  product: {
    id: number;
    handle: string;
    title: string;
    vendor: string;
    description: string;
    variants: ProductVariant[];
    options: { name: string; values: string[] }[];
    tags: string;
    accentColor?: string;
    image?: string | null;
  };
}

function pickVariant(variants: ProductVariant[]): ProductVariant | null {
  return variants.find(v => v.inventoryQuantity > 0) || variants[0] || null;
}

/**
 * The purchase column: artist, title, price, size, quantity and the two
 * actions, plus the trust row and share control.
 *
 * The long description lives in `ProductDescription` (rendered below the
 * gallery) rather than at the bottom of this column: the column is the sticky
 * rail, and a rail as tall as the gallery it sits beside has no room left to
 * stick, so the add-to-bag button would scroll away with the price anyway.
 */
export function ProductInfo({ product }: ProductInfoProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => pickVariant(product.variants)
  );
  const [quantity, setQuantity] = useState(1);
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied'>('idle');

  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);

  // Re-sync when navigating between products (the instance is reused).
  // Render-phase update: the documented alternative to setState-in-effect.
  const [prevProductId, setPrevProductId] = useState(product.id);
  if (prevProductId !== product.id) {
    setPrevProductId(product.id);
    setSelectedVariant(pickVariant(product.variants));
    setQuantity(1);
  }

  // Native share sheet on mobile, clipboard fallback on desktop.
  const handleShare = async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: product.title, url });
        setShareState('shared');
        return;
      } catch {
        return; // user dismissed — no fallback, no error UI
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // clipboard unavailable — stay silent, the button did nothing harmful
    }
  };

  if (!selectedVariant) {
    return (
      <div className="space-y-8">
        <h1 className="font-display text-3xl md:text-4xl text-text-primary">
          {product.title}
        </h1>
        <p className="font-body text-sm text-text-muted">
          This product is currently unavailable.
        </p>
      </div>
    );
  }

  // Get artist data
  const artistHandle = product.vendor?.toLowerCase().replace(/\s+/g, '-');
  const artistData = artistHandle ? ARTISTS[artistHandle] : null;
  const accentColor = product.accentColor || artistData?.accentColor || 'var(--accent)';

  const isOnSale = isPriceOnSale(selectedVariant.price, selectedVariant.compareAtPrice);
  const discount = isOnSale
    ? Math.round(((Number(selectedVariant.compareAtPrice) - Number(selectedVariant.price)) / Number(selectedVariant.compareAtPrice)) * 100)
    : 0;
  const isInStock = selectedVariant.inventoryQuantity > 0;
  const isLowStock = selectedVariant.inventoryQuantity > 0 && selectedVariant.inventoryQuantity <= 5;
  const maxQuantity = maxQuantityFor(selectedVariant.inventoryQuantity);

  // `position` order, the same one the quick view and the gallery use: sorting
  // by id here showed the same product's sizes in a different order than the
  // card's quick view did.
  const choices: VariantChoice[] = sortByPosition(product.variants).map((variant) => ({
    id: variant.id,
    label: variant.option1,
    available: variant.inventoryQuantity > 0,
  }));

  const handleSelectVariant = (id: number) => {
    const variant = product.variants.find((v) => v.id === id);
    if (variant) {
      setSelectedVariant(variant);
      setQuantity(1);
    }
  };

  const handleAddToCart = () => {
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productHandle: product.handle,
      title: product.title,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice,
      image: product.image || null,
      maxQuantity,
      artist: product.vendor,
    }, quantity);
    openCart();
  };

  return (
    <div className="space-y-8">
      {/* Artist Link */}
      {product.vendor && (
        <Reveal>
          <Link
            href={`/artist/${artistHandle}`}
            className="inline-flex items-center gap-2 font-accent text-xs tracking-[0.2em] text-accent transition-colors hover:text-accent-hover"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            {product.vendor.toUpperCase()}
          </Link>
        </Reveal>
      )}

      {/* Title */}
      <Reveal>
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl text-text-primary break-words">
          {product.title}
        </h1>
      </Reveal>

      {/* Price */}
      <Reveal className="flex flex-wrap items-center gap-4">
        <span className="font-heading text-3xl text-text-primary">
          {formatPrice(selectedVariant.price)}
        </span>
        {isOnSale && (
          <>
            <span className="font-body text-lg text-text-muted line-through">
              {formatPrice(selectedVariant.compareAtPrice!)}
            </span>
            <SaleBadge discount={discount} />
          </>
        )}
      </Reveal>

      {/* Size Selector */}
      {product.options.length > 0 && (
        <Reveal>
          <VariantPicker
            label={product.options[0].name}
            name={`variant-${product.id}`}
            choices={choices}
            selectedId={selectedVariant.id}
            onSelect={handleSelectVariant}
            accentColor={accentColor}
          />
          <div className="mt-3">
            <Link
              href="/size-guide"
              className="font-body text-xs text-text-muted underline underline-offset-2 hover:text-accent transition-colors"
            >
              Size Guide
            </Link>
          </div>
        </Reveal>
      )}

      {/* Stock Status */}
      {isLowStock && (
        <p className="flex items-center gap-2 text-danger">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <span className="text-sm font-body">
            Only {selectedVariant.inventoryQuantity} left in stock
          </span>
        </p>
      )}

      {/* Quantity & Add to Cart */}
      <Reveal className="flex flex-col sm:flex-row gap-4">
        <QuantityStepper
          value={quantity}
          max={maxQuantity}
          onChange={setQuantity}
          className="h-14"
        />

        <Button
          onClick={handleAddToCart}
          disabled={!isInStock}
          variant="primary"
          size="lg"
          className="flex-1"
        >
          <ShoppingBag size={18} aria-hidden="true" />
          {isInStock ? 'ADD TO BAG' : 'SOLD OUT'}
        </Button>

        <WishlistButton
          variant="boxed"
          size="lg"
          productId={product.id}
          productHandle={product.handle}
          title={product.title}
          price={selectedVariant.price}
          compareAtPrice={selectedVariant.compareAtPrice}
          image={product.image || ''}
          artist={product.vendor}
        />
      </Reveal>

      <TrustBadges className="py-6 border-t border-b border-border-default" />

      {/* Share */}
      <div className="flex items-center gap-4">
        <span className="font-accent text-xs tracking-[0.1em] text-text-muted">
          SHARE
        </span>
        <IconButton
          label={shareState === 'copied' ? 'Product link copied' : 'Share this product'}
          variant="ghost"
          size="sm"
          onClick={handleShare}
        >
          {shareState === 'copied' ? <Check size={16} /> : <Share2 size={16} />}
        </IconButton>
      </div>
    </div>
  );
}
