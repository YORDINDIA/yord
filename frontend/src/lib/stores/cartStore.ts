import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types/database';

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  _hasHydrated: boolean;
}

interface CartActions {
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setHasHydrated: (state: boolean) => void;
}

interface CartComputed {
  itemCount: () => number;
  subtotal: () => number;
  totalSavings: () => number;
}

type CartStore = CartState & CartActions & CartComputed;

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      isOpen: false,
      _hasHydrated: false,

      // Hydration setter
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      // Actions
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existingItem = state.items.find(i => i.variantId === item.variantId);

          if (existingItem) {
            // Update quantity if item exists
            const newQuantity = Math.min(
              existingItem.quantity + quantity,
              existingItem.maxQuantity
            );

            return {
              items: state.items.map(i =>
                i.variantId === item.variantId
                  ? { ...i, quantity: newQuantity }
                  : i
              ),
              isOpen: true, // Open cart drawer when adding
            };
          }

          // Add new item
          return {
            items: [...state.items, { ...item, quantity }],
            isOpen: true,
          };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter(i => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(i => i.variantId !== variantId),
            };
          }

          return {
            items: state.items.map(i =>
              i.variantId === variantId
                ? { ...i, quantity: Math.min(quantity, i.maxQuantity) }
                : i
            ),
          };
        });
      },

      clearCart: () => {
        set({ items: [], isOpen: false });
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      // Computed
      itemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      totalSavings: () => {
        return get().items.reduce((sum, item) => {
          if (item.compareAtPrice && item.compareAtPrice > item.price) {
            return sum + (item.compareAtPrice - item.price) * item.quantity;
          }
          return sum;
        }, 0);
      },
    }),
    {
      name: 'yord-cart',
      // Only persist items, not UI state
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selector hooks for specific pieces of state
export const useCartItems = () => useCartStore((state) => state.items);
export const useCartOpen = () => useCartStore((state) => state.isOpen);
export const useCartActions = () => useCartStore((state) => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  updateQuantity: state.updateQuantity,
  clearCart: state.clearCart,
  openCart: state.openCart,
  closeCart: state.closeCart,
  toggleCart: state.toggleCart,
}));
