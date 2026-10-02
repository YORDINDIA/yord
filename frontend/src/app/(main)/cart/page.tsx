import { Metadata } from 'next';
import { CartContent } from '@/features/cart/CartContent';

export const metadata: Metadata = {
  title: 'Shopping Bag',
  description: 'Review your cart and proceed to checkout. Premium artist-inspired fan merchandise.',
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-surface-page pt-20">
      <CartContent />
    </main>
  );
}
