'use client';

import { Heart } from 'lucide-react';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { cn } from '@/lib/utils';

interface WishlistButtonProps {
  productId: number;
  productHandle: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  image: string;
  artist?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WishlistButton({
  productId,
  productHandle,
  title,
  price,
  compareAtPrice = null,
  image,
  artist = null,
  size = 'md',
  className,
}: WishlistButtonProps) {
  const toggleItem = useWishlistStore((state) => state.toggleItem);
  // Subscribe to derived state (not the stable isInWishlist fn) so this re-renders on toggle
  const inWishlist = useWishlistStore((state) =>
    state.items.some((i) => i.productId === productId)
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem({
      productId,
      productHandle,
      title,
      price,
      compareAtPrice,
      image,
      artist,
    });
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center transition-all',
        sizeClasses[size],
        inWishlist
          ? 'text-red-400 hover:text-red-300'
          : 'text-ivory-400 hover:text-ivory-100',
        className
      )}
      aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        size={iconSizes[size]}
        className={cn(
          'transition-all',
          inWishlist ? 'fill-current' : ''
        )}
      />
    </button>
  );
}
