'use client';

import { Heart } from 'lucide-react';
import { cn } from '@yord/ui';
import { useWishlistStore } from '@/lib/stores/wishlistStore';
import { IconButton } from '@/features/ui/IconButton';

interface WishlistButtonProps {
  productId: number;
  productHandle: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  image: string;
  artist?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /**
   * `bare` is the icon-only heart for a card overlay; `boxed` draws the 48px
   * bordered square the PDP pairs with the add-to-bag button.
   */
  variant?: 'bare' | 'boxed';
  className?: string;
}

const ICON_SIZES = { sm: 16, md: 20, lg: 24 } as const;

export function WishlistButton({
  productId,
  productHandle,
  title,
  price,
  compareAtPrice = null,
  image,
  artist = null,
  size = 'md',
  variant = 'bare',
  className,
}: WishlistButtonProps) {
  const toggleItem = useWishlistStore((state) => state.toggleItem);
  // Subscribe to derived state (not the stable isInWishlist fn) so this re-renders on toggle
  const inWishlist = useWishlistStore((state) =>
    state.items.some((i) => i.productId === productId)
  );

  const handleClick = () => {
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

  const iconSize = ICON_SIZES[size];

  if (variant === 'boxed') {
    return (
      <IconButton
        label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        // Filled when saved, bordered when not — the two states come from the
        // button recipe rather than a `bg-*` override, which would race the
        // variant's own background for the cascade.
        variant={inWishlist ? 'solid' : 'outline'}
        size="lg"
        aria-pressed={inWishlist}
        onClick={handleClick}
        className={className}
      >
        <Heart size={iconSize} fill={inWishlist ? 'currentColor' : 'none'} />
      </IconButton>
    );
  }

  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={inWishlist}
      className={cn(
        'flex items-center justify-center transition-colors',
        sizeClasses[size],
        inWishlist
          ? 'text-danger hover:text-danger/80'
          : 'text-text-muted hover:text-text-secondary',
        className
      )}
      aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        size={iconSize}
        className={cn('transition-all', inWishlist ? 'fill-current' : '')}
      />
    </button>
  );
}
