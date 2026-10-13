'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { CheckoutForm } from '@/features/checkout/CheckoutForm';
import { OrderSummary } from '@/features/checkout/OrderSummary';
import { useCheckout } from '@/features/checkout/useCheckout';
import { RETURN_WINDOW_DAYS } from '@/features/checkout/constants';
import { Container } from '@/features/ui/Container';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { Skeleton } from '@/features/ui/Skeleton';

/**
 * Checkout: layout only. Cart totals, the Razorpay handoff and the redirect
 * live in `useCheckout`; the step state lives in the form.
 *
 * The cart read is gated on hydration. The store's default is `items: []`, so
 * without the gate every refresh painted the full-page "Your cart is empty"
 * takeover and then swapped to the form a beat later.
 */
export default function CheckoutPage() {
  const { items, hydrated, total, isProcessing, orderError, paymentError, placeOrder } =
    useCheckout();

  // The hook's error is the specific cause (cancelled, verify failed, gateway
  // down); `orderError` is only the fallback for a failure it cannot name.
  const errorMessage = paymentError ?? orderError;

  if (!hydrated) {
    return (
      <CheckoutShell>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2">
            <Skeleton variant="text-block" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton variant="text-block" />
          </div>
        </div>
      </CheckoutShell>
    );
  }

  if (items.length === 0) {
    return (
      <CheckoutShell>
        {isProcessing ? (
          // A payment just cleared and the cart was emptied for it. Showing
          // the empty state here would flash "your cart is empty" over a
          // completed order.
          <div role="status" className="py-24 text-center">
            <p className="font-display text-2xl text-text-primary">
              Processing your order…
            </p>
            <p className="mt-3 font-body text-text-muted">Please keep this tab open.</p>
          </div>
        ) : (
          <EmptyState
            title="Your cart is empty"
            message="Add some items to your bag before checking out."
          >
            <CtaLink href="/" variant="primary" size="lg">
              CONTINUE SHOPPING
            </CtaLink>
          </EmptyState>
        )}
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Checkout Form - 2 columns */}
        <div className="lg:col-span-2">
          {/* `role="alert"` + assertive: this banner is the only failure
              feedback in the funnel and it has to be announced, not just
              painted. */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 flex items-start gap-3 border border-danger bg-danger/10 p-4"
            >
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-body text-sm text-danger font-medium">Payment failed</p>
                <p className="font-body text-xs text-danger mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          <CheckoutForm
            onPlaceOrder={placeOrder}
            isProcessing={isProcessing}
            total={total}
          />
        </div>

        {/* Order Summary - 1 column */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 space-y-6">
            <OrderSummary />

            {/* Secure Checkout card */}
            <div className="bg-surface-card border border-border-default p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-accent" aria-hidden="true" />
                <span className="font-body text-sm text-text-secondary font-medium">
                  Secure Checkout
                </span>
              </div>
              <ul className="space-y-2 font-body text-xs text-text-muted">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1 h-1 bg-accent rounded-full" />
                  256-bit SSL encryption
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1 h-1 bg-accent rounded-full" />
                  Powered by Razorpay
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1 h-1 bg-accent rounded-full" />
                  PCI DSS compliant
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-1 h-1 bg-accent rounded-full" />
                  Free returns within {RETURN_WINDOW_DAYS} days
                </li>
              </ul>
            </div>

            {/* Need Help */}
            <p className="text-center font-body text-sm text-text-muted">
              Need help?{' '}
              <Link href="/contact" className="text-accent hover:underline">
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </div>
    </CheckoutShell>
  );
}

/** Page shell: back link, heading and the page grid. */
function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <Container>
        <div className="mb-8">
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary font-body text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Cart
          </Link>
          <h1 className="font-display text-3xl md:text-4xl text-text-primary">
            Checkout
          </h1>
        </div>
        {children}
      </Container>
    </div>
  );
}
