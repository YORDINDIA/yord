'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/stores/cartStore';
import { useCartHydrated } from '@/hooks/useHydrated';
import { useRazorpay } from '@/hooks/useRazorpay';
import { computeTotals } from '@/lib/pricing';
import { planRecoveredCartChanges } from './pendingVerify';
import { saveLastOrder } from './order';
import type { CheckoutData } from './types';

/**
 * Checkout orchestration: cart totals, the Razorpay handoff, the confirmation
 * payload and the redirect.
 *
 * Extracted from the checkout page so the page is layout only — and so the
 * pieces that are easy to get wrong (a stale error read, a stuck PROCESSING
 * state, the empty-cart flash after `clearCart`) live in one testable place.
 */
export function useCheckout() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const hydrated = useCartHydrated();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const { initiatePayment, error: paymentError } = useRazorpay();

  // Client-side display totals only. Both checkout routes recompute from DB
  // prices; nothing here is ever trusted as an amount to charge.
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { gstAmount, total } = computeTotals(subtotal);

  const placeOrder = useCallback(
    async (data: CheckoutData) => {
      setIsProcessing(true);
      setOrderError(null);

      try {
        const paymentResponse = await initiatePayment({
          customerName: `${data.shipping.firstName} ${data.shipping.lastName}`,
          customerEmail: data.shipping.email,
          customerPhone: data.shipping.phone,
          cartItems: items,
          shippingAddress: data.shipping,
        });

        if (!paymentResponse) {
          // The hook's own `error` state holds the specific cause and is
          // rendered directly by the page. Reading it *here* would read the
          // render that created this closure, where it is still null — the
          // reason the generic fallback used to win every time.
          setOrderError('Payment was cancelled or failed. Please try again.');
          setIsProcessing(false);
          return;
        }

        if (paymentResponse.recovered) {
          // A recovered pending payment: the cart it consumed is the snapshot
          // stored with the verify body, not necessarily the cart in the
          // store — the shopper may have edited it while the first payment
          // was stuck, so clearCart() would drop items this order never
          // touched. Remove exactly the ordered lines; nothing throws when a
          // variant is no longer in the cart. No confirmation payload is
          // written: the body carries no item titles, prices or total, so
          // anything rendered from it would be fabricated — the confirmation
          // screen falls back to the order number and ETA, which are real.
          // An unparseable snapshot leaves the cart untouched: the ordered
          // lines are unknown, and the current cart is not the order.
          const cart = useCartStore.getState();
          for (const change of planRecoveredCartChanges(
            cart.items,
            paymentResponse.recovered.snapshot?.cartItems ?? []
          )) {
            if (change.kind === 'remove') cart.removeItem(change.variantId);
            else cart.updateQuantity(change.variantId, change.quantity);
          }
          // `isProcessing` stays true on purpose, as below: the page must not
          // flash the "Your cart is empty" takeover over a payment that
          // succeeded.
          router.push(`/checkout/success?order_name=${encodeURIComponent(paymentResponse.order_name)}`);
          return;
        }

        saveLastOrder({
          orderName: paymentResponse.order_name,
          paymentId: paymentResponse.razorpay_payment_id,
          razorpayOrderId: paymentResponse.razorpay_order_id,
          shippingAddress: data.shipping,
          billingAddress: data.billing,
          items: items.map((item) => ({
            title: item.title,
            variantTitle: item.variantTitle,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          subtotal,
          gst: gstAmount,
          total,
        });

        // Clear the cart, then leave for the confirmation. `isProcessing` stays
        // true on purpose: the cart is empty now, and the page must not flash
        // the "Your cart is empty" takeover over a payment that just
        // succeeded. A throwing `push` lands in the catch below and resets it,
        // so a failed navigation cannot strand the button on PROCESSING.
        clearCart();
        router.push(`/checkout/success?order_name=${encodeURIComponent(paymentResponse.order_name)}`);
      } catch (error) {
        console.error('Order failed:', error);
        setOrderError(error instanceof Error ? error.message : 'Order failed. Please try again.');
        setIsProcessing(false);
      }
    },
    [clearCart, gstAmount, initiatePayment, items, router, subtotal, total]
  );

  return {
    items,
    hydrated,
    subtotal,
    gstAmount,
    total,
    isProcessing,
    orderError,
    /** The hook's specific failure cause; `orderError` is the fallback. */
    paymentError,
    placeOrder,
  };
}
