import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { track } from '@/lib/analytics/track';

interface WishlistItem {
  productId: number;
  productHandle: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  artist: string | null;
  addedAt: number;
}

interface WishlistState {
  items: WishlistItem[];
  _hasHydrated: boolean;
}

interface WishlistActions {
  addItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
  removeItem: (productId: number) => void;
  toggleItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
  isInWishlist: (productId: number) => boolean;
  clearWishlist: () => void;
  setHasHydrated: (state: boolean) => void;
}

interface WishlistComputed {
  itemCount: () => number;
}

type WishlistStore = WishlistState & WishlistActions & WishlistComputed;

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      _hasHydrated: false,

      // Hydration setter
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      // Actions
      addItem: (item) => {
        const existed = get().items.some((i) => i.productId === item.productId);
        set((state) => {
          // Check if item already exists
          if (state.items.some((i) => i.productId === item.productId)) {
            return state;
          }

          return {
            items: [
              ...state.items,
              { ...item, addedAt: Date.now() },
            ],
          };
        });
        // Only a genuinely new entry is an "add": re-toggling an existing
        // item must not inflate the admin's top-wishlisted ranking.
        if (!existed) {
          track({
            type: 'wishlist_added',
            productId: item.productId,
            handle: item.productHandle,
          });
        }
      },

      removeItem: (productId) => {
        const removed = get().items.find((i) => i.productId === productId);
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
        if (removed) {
          track({
            type: 'wishlist_removed',
            productId: removed.productId,
            handle: removed.productHandle,
          });
        }
      },

      toggleItem: (item) => {
        const { items, addItem, removeItem } = get();
        const exists = items.some((i) => i.productId === item.productId);

        if (exists) {
          removeItem(item.productId);
        } else {
          addItem(item);
        }
      },

      isInWishlist: (productId) => {
        return get().items.some((i) => i.productId === productId);
      },

      clearWishlist: () => {
        set({ items: [] });
      },

      // Computed
      itemCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'yord-wishlist',
      // Only persist items, not UI state
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selector hooks (useShallow keeps the actions object identity stable)
export const useWishlistItems = () => useWishlistStore((state) => state.items);
export const useWishlistActions = () => useWishlistStore(useShallow((state) => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  toggleItem: state.toggleItem,
  clearWishlist: state.clearWishlist,
})));
