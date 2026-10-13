import { Metadata } from 'next';
import { CartContent } from '@/features/cart/CartContent';

export const metadata: Metadata = {
  title: 'Shopping Bag',
  description: 'Review your cart and proceed to checkout. Premium artist-inspired fan merchandise.',
  // Per-shopper state, never a page to rank: the bag has no stable content.
  robots: { index: false, follow: false },
  alternates: { canonical: '/cart' },
};

export default function CartPage() {
  return (
    <div className="min-h-screen bg-surface-page pt-20">
      <CartContent />
    </div>
  );
}
