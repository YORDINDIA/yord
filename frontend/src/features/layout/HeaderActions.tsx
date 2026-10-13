'use client';

import Link from 'next/link';
import { Search, ShoppingBag, User, Menu, X } from 'lucide-react';
import { cn } from '@yord/ui';
import { useCartStore } from '@/lib/stores/cartStore';
import { ThemeToggle } from '@/features/ui/ThemeToggle';
import { HEADER_TONE } from './headerTone';

export interface HeaderActionsProps {
  onMedia: boolean;
  menuOpen: boolean;
  menuId: string;
  onToggleMenu: () => void;
  onOpenSearch: () => void;
  /** Warms the search modal's chunk on hover/focus of a search trigger. */
  onWarmSearch: () => void;
}

/** The header's right-hand cluster: theme, search, account, cart, menu toggle. */
export function HeaderActions({
  onMedia,
  menuOpen,
  menuId,
  onToggleMenu,
  onOpenSearch,
  onWarmSearch,
}: HeaderActionsProps) {
  const tone = HEADER_TONE[onMedia ? 'media' : 'surface'];
  const actionClasses = cn(
    'w-10 h-10 items-center justify-center transition-colors',
    tone.text,
    tone.hover
  );

  const hasHydrated = useCartStore((state) => state._hasHydrated);
  const cartItemCount = useCartStore((state) => state.itemCount());
  const toggleCart = useCartStore((state) => state.toggleCart);

  return (
    <div className="flex items-center gap-4">
      <ThemeToggle className="hidden sm:block" tone={onMedia ? 'media' : 'surface'} />

      <button
        type="button"
        onClick={onOpenSearch}
        onPointerEnter={onWarmSearch}
        onFocus={onWarmSearch}
        className={cn('hidden sm:flex', actionClasses)}
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      <Link href="/account" className={cn('hidden sm:flex', actionClasses)} aria-label="Account">
        <User size={20} />
      </Link>

      <button
        type="button"
        onClick={toggleCart}
        className={cn('relative flex', actionClasses)}
        aria-label={`Cart with ${hasHydrated ? cartItemCount : 0} items`}
      >
        <ShoppingBag size={20} />
        {/* Stays mounted so the count can scale in with a CSS transition; while
            empty it is scaled to nothing and hidden from assistive tech (the
            button label carries the count). */}
        <span
          aria-hidden={!(hasHydrated && cartItemCount > 0)}
          className={cn(
            'absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-accent text-text-on-accent text-[10px] font-bold rounded-full transition-transform duration-200 ease-out',
            hasHydrated && cartItemCount > 0 ? 'scale-100' : 'scale-0'
          )}
        >
          {cartItemCount > 9 ? '9+' : cartItemCount}
        </span>
      </button>

      {/* `aria-expanded` + `aria-controls` are what tell a screen reader the
          drawer is open; the icon swap alone is invisible to it. */}
      <button
        type="button"
        onClick={onToggleMenu}
        className={cn('lg:hidden flex', actionClasses)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls={menuId}
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  );
}
