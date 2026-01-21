import { Metadata } from 'next';
import { CartContent } from '@/components/cart/CartContent';

export const metadata: Metadata = {
  title: 'Shopping Bag | YORD India',
  description: 'Review your cart and proceed to checkout. Premium artist-inspired fan merchandise.',
};

export default function CartPage() {
  return (
    <main className="min-h-screen bg-noir-950 pt-20">
      <CartContent />
    </main>
  );
}
