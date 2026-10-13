import type { Metadata } from 'next';

/**
 * `page.tsx` is a client component (cart hydration, Razorpay handoff), and a
 * client component cannot export metadata, so this route declares it here.
 *
 * Checkout is per-shopper state: there is no content to rank and no stable
 * content to index, so it stays out of the index entirely.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: '/checkout' },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
