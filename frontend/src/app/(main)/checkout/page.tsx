'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { CheckoutForm, CheckoutData } from '@/components/checkout/CheckoutForm';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { useCartStore } from '@/lib/stores/cartStore';
import { useRazorpay } from '@/hooks/useRazorpay';
import { computeTotals } from '@/lib/pricing';

export default function CheckoutPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const items = useCartStore((state) => state.items);
  const subtotalFn = useCartStore((state) => state.subtotal);
  const clearCart = useCartStore((state) => state.clearCart);
  const { initiatePayment, error: paymentError } = useRazorpay();

  // Calculate total with GST (single source in lib/pricing)
  const subtotal = subtotalFn();
  const { gstAmount, total } = computeTotals(subtotal);

  const handlePlaceOrder = async (data: CheckoutData) => {
    setIsProcessing(true);
    setOrderError(null);

    try {
      // Initiate Razorpay payment with full order data
      // (server recomputes totals from DB prices; client totals are display-only)
      const paymentResponse = await initiatePayment({
        customerName: `${data.shipping.firstName} ${data.shipping.lastName}`,
        customerEmail: data.shipping.email,
        customerPhone: data.shipping.phone,
        cartItems: items,
        shippingAddress: data.shipping,
      });

      if (!paymentResponse) {
        // Payment was cancelled or failed
        setOrderError(paymentError || 'Payment was cancelled or failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Payment successful - store order details in session storage for success page
      const orderDetails = {
        paymentId: paymentResponse.razorpay_payment_id,
        orderId: paymentResponse.razorpay_order_id,
        shippingAddress: data.shipping,
        billingAddress: data.billing,
        items: items.map(item => ({
          title: item.title,
          variantTitle: item.variantTitle,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        subtotal,
        gst: gstAmount,
        total,
      };
      sessionStorage.setItem('yord_last_order', JSON.stringify(orderDetails));

      // Clear cart and redirect to success page.
      // Pass the YORD order name (trackable) rather than the Razorpay gateway id.
      clearCart();
      router.push(`/checkout/success?order_name=${encodeURIComponent(paymentResponse.order_name)}`);
    } catch (error) {
      console.error('Order failed:', error);
      setOrderError(error instanceof Error ? error.message : 'Order failed. Please try again.');
      setIsProcessing(false);
    }
  };

  // Redirect if cart is empty
  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-noir-950 pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="text-center py-24">
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-ivory-50 mb-4">
              Your cart is empty
            </h1>
            <p className="font-[family-name:var(--font-jakarta)] text-ivory-400 mb-8">
              Add some items to your cart before checking out.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
            >
              CONTINUE SHOPPING
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-ivory-400 hover:text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Cart
          </Link>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-ivory-50">
            Checkout
          </h1>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Checkout Form - 2 columns */}
          <div className="lg:col-span-2">
            {/* Error Message */}
            {orderError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-300 font-medium">
                    Payment Failed
                  </p>
                  <p className="font-[family-name:var(--font-jakarta)] text-xs text-red-400 mt-1">
                    {orderError}
                  </p>
                </div>
              </div>
            )}
            <CheckoutForm
              onPlaceOrder={handlePlaceOrder}
              isProcessing={isProcessing}
            />
          </div>

          {/* Order Summary - 1 column */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-6">
              <OrderSummary isCompact />

              {/* Trust Badges */}
              <div className="bg-noir-900 border border-noir-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-gold-200" />
                  <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100 font-medium">
                    Secure Checkout
                  </span>
                </div>
                <ul className="space-y-2 font-[family-name:var(--font-jakarta)] text-xs text-ivory-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-gold-200 rounded-full" />
                    256-bit SSL encryption
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-gold-200 rounded-full" />
                    Powered by Razorpay
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-gold-200 rounded-full" />
                    PCI DSS compliant
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-gold-200 rounded-full" />
                    Free returns within 7 days
                  </li>
                </ul>
              </div>

              {/* Need Help */}
              <div className="text-center font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                Need help?{' '}
                <Link href="/contact" className="text-gold-200 hover:underline">
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
