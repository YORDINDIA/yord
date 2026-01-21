import Link from 'next/link';
import { CheckCircle, Package, Mail } from 'lucide-react';

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ order_id?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { order_id } = await searchParams;
  // Use the order ID from URL params, or show a generic message
  const orderId = order_id || 'YORD-PENDING';

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-[600px] mx-auto px-6 text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50 mb-4">
            Order Confirmed!
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 text-lg">
            Thank you for shopping with YORD India
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-noir-900 border border-noir-800 p-8 mb-8">
          <div className="mb-6">
            <p className="font-[family-name:var(--font-jakarta)] text-xs uppercase tracking-wider text-ivory-500 mb-1">
              Order Number
            </p>
            <p className="font-[family-name:var(--font-bebas)] text-2xl text-gold-200 tracking-wider">
              {orderId}
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div className="flex items-start gap-4 p-4 bg-noir-800/50 border border-noir-700">
              <Mail className="w-5 h-5 text-gold-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100 font-medium">
                  Confirmation Email Sent
                </p>
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-400 mt-1">
                  We&apos;ve sent a confirmation email with your order details and tracking information.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-noir-800/50 border border-noir-700">
              <Package className="w-5 h-5 text-gold-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100 font-medium">
                  Shipping Updates
                </p>
                <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-400 mt-1">
                  You&apos;ll receive SMS and email updates as your order ships. Most orders arrive within 5-7 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className="mb-8">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-100 mb-4">
            What&apos;s Next?
          </h2>
          <ul className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 space-y-2">
            <li>• Your order will be processed within 24 hours</li>
            <li>• You&apos;ll receive tracking details once shipped</li>
            <li>• Contact us if you have any questions</li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
          >
            CONTINUE SHOPPING
          </Link>
          <Link
            href="/account/orders"
            className="px-8 py-3 border border-ivory-500 text-ivory-100 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-ivory-300 transition-colors"
          >
            VIEW ORDER STATUS
          </Link>
        </div>

        {/* Social Share */}
        <div className="mt-12 pt-8 border-t border-noir-800">
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-4">
            Share your excitement with friends
          </p>
          <div className="flex justify-center gap-4">
            <button className="w-10 h-10 flex items-center justify-center bg-noir-800 text-ivory-400 hover:text-ivory-100 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-noir-800 text-ivory-400 hover:text-ivory-100 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-noir-800 text-ivory-400 hover:text-ivory-100 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
