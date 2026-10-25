'use client';

import { useState, useCallback } from 'react';
import {
  loadRazorpayScript,
  createRazorpayCheckout,
  RazorpayPaymentResponse,
  RazorpayCheckoutOptions,
} from '@/lib/razorpay/client';
import { analyticsSessionId, track } from '@/lib/analytics/track';
import { usePromoStore } from '@/lib/stores/promoStore';
import {
  clearPendingVerify,
  isSettledVerifyFailure,
  pendingVerifyStorage,
  reconcilePendingVerify,
  rememberPendingVerify,
  type PendingOrderSnapshot,
} from '@/features/checkout/pendingVerify';
import type { CartItem } from '@yord/db-types';

interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface CreateOrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  cartItems: CartItem[];
  shippingAddress: ShippingAddress;
}

interface UseRazorpayReturn {
  isLoading: boolean;
  error: string | null;
  initiatePayment: (data: CreateOrderData) => Promise<VerifiedPaymentResponse | null>;
}

// Razorpay handler payload plus the trackable YORD order name from verify-payment.
export interface VerifiedPaymentResponse extends RazorpayPaymentResponse {
  order_name: string;
  /**
   * Present only when this payment was recovered from a pending-verify
   * replay. `snapshot` is the order the stored body describes (null when it
   * could not be parsed); the checkout removes exactly those lines and never
   * clears the cart. Absent on a fresh payment, where the cart is cleared.
   */
  recovered?: { snapshot: PendingOrderSnapshot | null };
}

/**
 * One verify request, bounded by `timeoutMs`. Used by the first attempt, the
 * reconcile retries and the pending-verify replay, so all three send
 * byte-identical bodies and the server's confirmation_number idempotency
 * covers every one of them. A timeout aborts only the browser request — the
 * server may still be finishing the order.
 */
async function postVerify(body: string, timeoutMs: number) {
  const verifyResponse = await fetch('/api/checkout/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const verifyData = (await verifyResponse.json().catch(() => ({}))) as {
    order_name?: string;
    error?: string;
    code?: string;
  };
  return { verifyResponse, verifyData };
}

export function useRazorpay(): UseRazorpayReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read straight from the store rather than through `CreateOrderData`: the
  // code is global cart state, and `useCheckout` would otherwise have to thread
  // it through a parameter that only this hook reads.
  const promoCode = usePromoStore((state) => state.code);
  const clearPromo = usePromoStore((state) => state.clear);

  const initiatePayment = useCallback(async (data: CreateOrderData): Promise<VerifiedPaymentResponse | null> => {
    setIsLoading(true);
    setError(null);

    // Failure attribution for the pre-Razorpay phase. Once checkout_started
    // fires (server-validated cart in hand), failures are tracked at their
    // own sites (verify catch, ondismiss) and this fallback stands down so a
    // payment that reached the gateway is never double-counted as
    // `create_order`.
    let pendingStep: 'create_order' | 'razorpay' | null = 'create_order';

    try {
      // Reconcile before charging. A payment the gateway captured but whose
      // verify call was lost (tab closed, every retry failed) is re-POSTed
      // with the same ids: the server is idempotent on the payment id, so the
      // call either records the order that is missing or proves the payment
      // is settled. Creating a new Razorpay order first is how a customer who
      // pays again for a payment that did land gets charged twice.
      const pending = await reconcilePendingVerify({
        storage: pendingVerifyStorage(),
        post: async (body) => {
          // 20s: a single replay the shopper is waiting on, not the retry
          // ladder below.
          const { verifyResponse, verifyData } = await postVerify(body, 20000);
          return {
            ok: verifyResponse.ok,
            status: verifyResponse.status,
            orderName: verifyData.order_name ?? null,
            code: verifyData.code ?? null,
          };
        },
      });

      if (pending.kind === 'recovered') {
        // The order exists. Resolve as a success so the cart is reconciled and
        // the confirmation shown, without a second charge. The snapshot rides
        // along so the checkout can remove exactly what the recovered order
        // consumed instead of wiping whatever the cart holds now.
        return {
          razorpay_payment_id: pending.ids.razorpay_payment_id,
          razorpay_order_id: pending.ids.razorpay_order_id,
          razorpay_signature: pending.ids.razorpay_signature,
          order_name: pending.orderName,
          recovered: { snapshot: pending.snapshot },
        };
      }
      if (pending.kind === 'blocked') {
        // Deliberately not a gateway error: no new payment was started, and
        // the hook's `error` (rendered by the page over the generic fallback)
        // explains why. `pendingStep` stays as-is because nothing was charged
        // or attempted at the gateway, so this must not be tracked as a
        // create_order failure.
        setError(pending.message);
        return null;
      }

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay. Please try again.');
      }

      // Create order on server (server computes totals from DB prices, and
      // resolves `code` itself — the client never sends a percent or an amount).
      const orderResponse = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: 'INR',
          items: data.cartItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          ...(promoCode ? { code: promoCode } : {}),
        }),
      });

      if (!orderResponse.ok) {
        const errorData = (await orderResponse.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        // A code that stopped working between the promo field and this request
        // is a 409 CODE_INVALID. Drop it from the store so the cart stops
        // showing a discount the shopper cannot get, and surface the server's
        // own message rather than a generic failure.
        if (errorData.code === 'CODE_INVALID') {
          clearPromo();
        }
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderData = await orderResponse.json();

      // Funnel: the server-validated cart is about to become a payment.
      // Totals come from the server response, not the client cart.
      track({
        type: 'checkout_started',
        cartValue: Number(orderData.total) || 0,
        cartItems: data.cartItems.reduce((sum, item) => sum + item.quantity, 0),
      });

      // Open Razorpay checkout
      return new Promise((resolve, reject) => {
        const options: RazorpayCheckoutOptions = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'YORD India',
          description: 'Concert Fashion & Merchandise',
          order_id: orderData.id,
          prefill: {
            name: data.customerName,
            email: data.customerEmail,
            contact: data.customerPhone,
          },
          theme: {
            color: '#C9A227', // Gold color
          },
          handler: async (response) => {
            // The payment reached the gateway, so the pre-gateway fallback
            // stands down: from here the verify catch and ondismiss track
            // outcomes themselves.
            pendingStep = null;
            // The verify body is reused verbatim for every reconcile attempt:
            // same payment ids, so the server's confirmation_number lookup
            // makes re-POSTs idempotent instead of duplicate orders. The same
            // body is what a later visit re-POSTs (see pendingVerify).
            const verifyBody = JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              // Joins the server-recorded order_completed event to this
              // browser's behavioral session (random uuid, no PII).
              analyticsSid: analyticsSessionId(),
              // The code is re-sent so verify can re-reserve it. A retry takes
              // its own hold back (idempotent); a code that was spent by someone
              // else in the meantime makes the recomputed total miss the
              // captured amount, and verify refunds instead of charging more.
              ...(promoCode ? { code: promoCode } : {}),
              // Order data for Supabase (server recomputes prices/totals)
              orderData: {
                email: data.customerEmail,
                phone: data.customerPhone,
                shippingAddress: data.shippingAddress,
                cartItems: data.cartItems.map(item => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                })),
              },
            });
            // Persist before the first network request. A rejected fetch can
            // happen before a Response exists (for example a TypeError during
            // a dropped connection), after the gateway has already captured.
            rememberPendingVerify(pendingVerifyStorage(), verifyBody);

            try {
              // First attempt: 30s so a hung verify never leaves checkout
              // pending forever. A timeout here aborts only the browser
              // request — the server may still create the order — so it is
              // reconciled below, never reported as failure.
              let answer: { status: number; code: string | null; message: string } | null = null;
              let lastError: unknown = new Error('Verification timed out');
              try {
                const { verifyResponse, verifyData } = await postVerify(verifyBody, 30000);
                if (verifyResponse.ok) {
                  clearPendingVerify(pendingVerifyStorage(), response.razorpay_payment_id);
                  resolve({ ...response, order_name: verifyData.order_name ?? '' });
                  return;
                }
                answer = {
                  status: verifyResponse.status,
                  code: verifyData.code ?? null,
                  message: verifyData.error || 'Payment verification failed',
                };
              } catch (err) {
                // Network TypeError, timeout and abort all leave capture
                // unresolved. The durable body above protects a later retry.
                lastError = err;
              }

              if (
                answer &&
                isSettledVerifyFailure({
                  ok: false,
                  status: answer.status,
                  orderName: null,
                  code: answer.code,
                })
              ) {
                // Only server codes that prove refund completion (or the
                // gateway's no-capture response) permit a fresh checkout.
                clearPendingVerify(pendingVerifyStorage(), response.razorpay_payment_id);
                throw new Error(answer.message);
              }

              // Durable reconciliation: the payment is captured, so re-POST
              // the same ids (server returns the existing order when the
              // first attempt actually succeeded) instead of failing and
              // inviting a retry that charges twice. The stored body is what
              // a later visit replays when this tab is closed before the loop
              // finishes (see pendingVerify).
              for (let attempt = 0; attempt < 3; attempt += 1) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                let settledMessage: string | null = null;
                try {
                  const { verifyResponse, verifyData } = await postVerify(verifyBody, 45000);
                  if (verifyResponse.ok) {
                    clearPendingVerify(pendingVerifyStorage(), response.razorpay_payment_id);
                    resolve({ ...response, order_name: verifyData.order_name ?? '' });
                    return;
                  }
                  // Only settled refund/no-capture codes allow another charge.
                  lastError = new Error(verifyData.error || 'Payment verification failed');
                  if (
                    isSettledVerifyFailure({
                      ok: false,
                      status: verifyResponse.status,
                      orderName: null,
                      code: verifyData.code ?? null,
                    })
                  ) {
                    clearPendingVerify(pendingVerifyStorage(), response.razorpay_payment_id);
                    settledMessage = verifyData.error || 'Payment verification failed';
                  }
                } catch (err) {
                  lastError = err;
                }
                if (settledMessage) throw new Error(settledMessage);
              }
              throw lastError instanceof Error
                ? new Error(
                    `${lastError.message}. Your payment may have completed — check Account → Orders before paying again.`
                  )
                : lastError;
            } catch (err) {
              // Verify failures (timeout after all retries, definitive
              // rejection) land here once; the reconcile loop's swallowed
              // timeout never reaches this.
              track({ type: 'checkout_failed', step: 'verify' });
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              // Abandonment at the gateway is its own funnel step, so a
              // dismissed modal never reads as a verify failure.
              track({ type: 'checkout_failed', step: 'dismissed' });
              pendingStep = null;
              setIsLoading(false);
              reject(new Error('Payment cancelled'));
            },
            escape: false,
            backdropclose: false,
          },
        };

        try {
          const razorpay = createRazorpayCheckout(options);
          pendingStep = 'razorpay';
          razorpay.open();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      // Pre-gateway failures (script, server order creation, checkout open).
      // Null once the gateway took over — those outcomes track themselves.
      if (pendingStep !== null) {
        track({
          type: 'checkout_failed',
          step: pendingStep,
          ...(err instanceof Error ? { code: err.message.slice(0, 64) } : {}),
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clearPromo, promoCode]);

  return { isLoading, error, initiatePayment };
}
