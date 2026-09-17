'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart, Share2, Truck, Shield, RotateCcw, Check, Minus, Plus } from 'lucide-react';
import { formatPrice, cn, sanitizeHtml, isPriceOnSale } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { Button } from '@/components/ui/Button';
import { ARTISTS } from '@/types/database';

interface ProductVariant {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  option1: string;
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

export function ProductInfo({ product }: ProductInfoProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => pickVariant(product.variants)
  );
  const [quantity, setQuantity] = useState(1);

  // Re-sync when navigating between products (the instance is reused).
  // Render-phase update: the documented alternative to setState-in-effect.
  const [prevProductId, setPrevProductId] = useState(product.id);
  if (prevProductId !== product.id) {
    setPrevProductId(product.id);
    setSelectedVariant(pickVariant(product.variants));
    setQuantity(1);
  }

  const addItem = useCartStore((state) => state.addItem);
  const openCart = useCartStore((state) => state.openCart);
  const toggleWishlist = useWishlistStore((state) => state.toggleItem);
  // Subscribe to derived state (not the stable isInWishlist fn) so this re-renders on toggle
  const isWishlisted = useWishlistStore((state) =>
    state.items.some((i) => i.productId === product.id)
  );

  if (!selectedVariant) {
    return (
      <div className="space-y-8">
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50">
          {product.title}
        </h1>
        <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
          This product is currently unavailable.
        </p>
      </div>
    );
  }

  // Handle wishlist toggle
  const handleToggleWishlist = () => {
    toggleWishlist({
      productId: product.id,
      productHandle: product.handle,
      title: product.title,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice,
      image: product.image || '',
      artist: product.vendor,
    });
  };

  // Get artist data
  const artistHandle = product.vendor?.toLowerCase().replace(/\s+/g, '-');
  const artistData = artistHandle ? ARTISTS[artistHandle] : null;
  const accentColor = product.accentColor || artistData?.accentColor || '#FFD966';

  const isOnSale = isPriceOnSale(selectedVariant.price, selectedVariant.compareAtPrice);
  const discount = isOnSale
    ? Math.round(((Number(selectedVariant.compareAtPrice) - Number(selectedVariant.price)) / Number(selectedVariant.compareAtPrice)) * 100)
    : 0;
  const isInStock = selectedVariant.inventoryQuantity > 0;
  const isLowStock = selectedVariant.inventoryQuantity > 0 && selectedVariant.inventoryQuantity <= 5;

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
      maxQuantity: selectedVariant.inventoryQuantity,
      artist: product.vendor,
    }, quantity);
    openCart();
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb-style Artist Link */}
      {product.vendor && (
        <motion.a
          href={`/artist/${artistHandle}`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 font-[family-name:var(--font-bebas)] text-xs tracking-[0.2em] transition-colors"
          style={{ color: accentColor }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          {product.vendor.toUpperCase()}
        </motion.a>
      )}

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl lg:text-5xl text-ivory-50"
      >
        {product.title}
      </motion.h1>

      {/* Price */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-4"
      >
        <span className="font-[family-name:var(--font-cormorant)] text-3xl text-ivory-50">
          {formatPrice(selectedVariant.price)}
        </span>
        {isOnSale && (
          <>
            <span className="font-[family-name:var(--font-jakarta)] text-lg text-ivory-400 line-through">
              {formatPrice(selectedVariant.compareAtPrice!)}
            </span>
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-sm font-[family-name:var(--font-bebas)] tracking-wider">
              {discount}% OFF
            </span>
          </>
        )}
      </motion.div>

      {/* Size Selector */}
      {product.options.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] text-ivory-400">
              {product.options[0].name.toUpperCase()}
            </span>
            <a href="/size-guide" className="text-sm text-ivory-400 hover:text-gold-200 underline">
              Size Guide
            </a>
          </div>
          <div className="flex flex-wrap gap-3">
            {product.variants.map((variant) => {
              const isAvailable = variant.inventoryQuantity > 0;
              const isSelected = selectedVariant.id === variant.id;

              return (
                <button
                  key={variant.id}
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedVariant(variant);
                      setQuantity(1);
                    }
                  }}
                  disabled={!isAvailable}
                  className={cn(
                    'min-w-[48px] h-12 px-4 flex items-center justify-center border-2 transition-all duration-200',
                    'font-[family-name:var(--font-bebas)] text-sm tracking-wider',
                    isSelected
                      ? 'border-current text-noir-950'
                      : isAvailable
                      ? 'border-noir-700 text-ivory-100 hover:border-ivory-400'
                      : 'border-noir-800 text-noir-600 cursor-not-allowed line-through'
                  )}
                  style={{
                    backgroundColor: isSelected ? accentColor : 'transparent',
                    borderColor: isSelected ? accentColor : undefined,
                  }}
                >
                  {variant.option1}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stock Status */}
      {isLowStock && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-amber-500"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-[family-name:var(--font-jakarta)]">
            Only {selectedVariant.inventoryQuantity} left in stock
          </span>
        </motion.div>
      )}

      {/* Quantity & Add to Cart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {/* Quantity Selector */}
        <div className="flex items-center border border-noir-700">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-12 h-12 flex items-center justify-center text-ivory-400 hover:text-ivory-50 hover:bg-noir-800 transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="w-12 h-12 flex items-center justify-center text-ivory-50 font-[family-name:var(--font-jakarta)]">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(Math.min(selectedVariant.inventoryQuantity, quantity + 1))}
            disabled={quantity >= selectedVariant.inventoryQuantity}
            className={cn(
              'w-12 h-12 flex items-center justify-center transition-colors',
              quantity >= selectedVariant.inventoryQuantity
                ? 'text-noir-600 cursor-not-allowed'
                : 'text-ivory-400 hover:text-ivory-50 hover:bg-noir-800'
            )}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Add to Cart Button */}
        <Button
          onClick={handleAddToCart}
          disabled={!isInStock}
          variant="gold"
          size="lg"
          className="flex-1"
        >
          <ShoppingBag size={18} />
          {isInStock ? 'ADD TO BAG' : 'SOLD OUT'}
        </Button>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className={cn(
            'w-12 h-12 flex items-center justify-center border transition-colors',
            isWishlisted
              ? 'border-red-500 bg-red-500/10 text-red-500'
              : 'border-noir-700 text-ivory-400 hover:text-red-500 hover:border-red-500'
          )}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </motion.div>

      {/* Trust Badges */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-3 gap-4 py-6 border-t border-b border-noir-800"
      >
        <div className="text-center">
          <Truck size={20} className="mx-auto mb-2 text-gold-200" />
          <span className="block text-xs text-ivory-400 font-[family-name:var(--font-jakarta)]">
            Free Shipping
          </span>
          <span className="block text-[10px] text-ivory-500">Over ₹1,999</span>
        </div>
        <div className="text-center">
          <Shield size={20} className="mx-auto mb-2 text-gold-200" />
          <span className="block text-xs text-ivory-400 font-[family-name:var(--font-jakarta)]">
            Premium Quality
          </span>
          <span className="block text-[10px] text-ivory-500">Fan Made</span>
        </div>
        <div className="text-center">
          <RotateCcw size={20} className="mx-auto mb-2 text-gold-200" />
          <span className="block text-xs text-ivory-400 font-[family-name:var(--font-jakarta)]">
            Easy Returns
          </span>
          <span className="block text-[10px] text-ivory-500">14 Days</span>
        </div>
      </motion.div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="prose prose-invert prose-gold max-w-none"
      >
        <h3 className="font-[family-name:var(--font-bebas)] text-sm tracking-[0.15em] text-ivory-400 mb-4">
          DESCRIPTION
        </h3>
        <div
          className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-300 space-y-4 [&_h4]:font-[family-name:var(--font-bebas)] [&_h4]:text-xs [&_h4]:tracking-[0.1em] [&_h4]:text-ivory-400 [&_h4]:mt-6 [&_h4]:mb-2 [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:before:content-[''] [&_li]:before:w-1.5 [&_li]:before:h-1.5 [&_li]:before:rounded-full"
          style={{
            '--tw-prose-bullets': accentColor,
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
        />
      </motion.div>

      {/* Share */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-4"
      >
        <span className="font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400">
          SHARE
        </span>
        <button className="w-8 h-8 flex items-center justify-center text-ivory-400 hover:text-gold-200 transition-colors">
          <Share2 size={16} />
        </button>
      </motion.div>
    </div>
  );
}
