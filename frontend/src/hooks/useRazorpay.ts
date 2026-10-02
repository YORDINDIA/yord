'use client';

import { useState, useCallback } from 'react';
import {
  loadRazorpayScript,
  createRazorpayCheckout,
  RazorpayPaymentResponse,
  RazorpayCheckoutOptions,
} from '@/lib/razorpay/client';
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
}

// Durable reconcile state: a payment captured but not yet verified survives a
// reload in sessionStorage, so the next checkout can re-POST the same ids
// (idempotent on the server) instead of charging again.
const PENDING_VERIFY_KEY = 'yord:pending-verify';

function rememberPendingVerify(paymentId: string, body: string) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(
      PENDING_VERIFY_KEY,
      JSON.stringify({ paymentId, body, at: Date.now() })
    );
  } catch {
    // Storage unavailable: reconciliation still runs in-memory below.
  }
}

function clearPendingVerify(paymentId: string) {
  try {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(PENDING_VERIFY_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw) as { paymentId?: string };
    if (pending.paymentId === paymentId) sessionStorage.removeItem(PENDING_VERIFY_KEY);
  } catch {
    // Ignore storage failures on the cleanup path.
  }
}

export function useRazorpay(): UseRazorpayReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = useCallback(async (data: CreateOrderData): Promise<VerifiedPaymentResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay. Please try again.');
      }

      // Create order on server (server computes totals from DB prices)
      const orderResponse = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: 'INR',
          items: data.cartItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderData = await orderResponse.json();

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
            // The verify body is reused verbatim for every reconcile attempt:
            // same payment ids, so the server's confirmation_number lookup
            // makes re-POSTs idempotent instead of duplicate orders.
            const verifyBody = JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
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

            async function postVerify(timeoutMs: number) {
              const verifyResponse = await fetch('/api/checkout/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: verifyBody,
                signal: AbortSignal.timeout(timeoutMs),
              });
              const verifyData = (await verifyResponse.json().catch(() => ({}))) as {
                order_name?: string;
                error?: string;
                code?: string;
              };
              return { verifyResponse, verifyData };
            }

            function isTimeout(err: unknown): boolean {
              return (
                err instanceof DOMException &&
                (err.name === 'TimeoutError' || err.name === 'AbortError')
              );
            }

            try {
              // First attempt: 30s so a hung verify never leaves checkout
              // pending forever. A timeout here aborts only the browser
              // request — the server may still create the order — so it is
              // reconciled below, never reported as failure.
              try {
                const { verifyResponse, verifyData } = await postVerify(30000);
                if (!verifyResponse.ok) {
                  throw new Error(verifyData.error || 'Payment verification failed');
                }
                clearPendingVerify(response.razorpay_payment_id);
                resolve({ ...response, order_name: verifyData.order_name ?? '' });
                return;
              } catch (err) {
                if (!isTimeout(err)) throw err;
              }

              // Durable reconciliation: the payment is captured, so re-POST
              // the same ids (server returns the existing order when the
              // first attempt actually succeeded) instead of failing and
              // inviting a retry that charges twice.
              rememberPendingVerify(response.razorpay_payment_id, verifyBody);
              let lastError: unknown = new Error('Verification timed out');
              for (let attempt = 0; attempt < 3; attempt += 1) {
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                try {
                  const { verifyResponse, verifyData } = await postVerify(45000);
                  if (verifyResponse.ok) {
                    clearPendingVerify(response.razorpay_payment_id);
                    resolve({ ...response, order_name: verifyData.order_name ?? '' });
                    return;
                  }
                  // Definitive server rejections (amount mismatch, stock,
                  // bad signature) are terminal: no order will appear.
                  lastError = new Error(verifyData.error || 'Payment verification failed');
                  if (
                    verifyResponse.status === 400 ||
                    verifyResponse.status === 402 ||
                    verifyResponse.status === 409
                  ) {
                    break;
                  }
                } catch (err) {
                  lastError = err;
                  if (!isTimeout(err)) break;
                }
              }
              throw lastError instanceof Error
                ? new Error(
                    `${lastError.message}. Your payment may have completed — check Account → Orders before paying again.`
                  )
                : lastError;
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              setIsLoading(false);
              reject(new Error('Payment cancelled'));
            },
            escape: false,
            backdropclose: false,
          },
        };

        try {
          const razorpay = createRazorpayCheckout(options);
          razorpay.open();
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, initiatePayment };
}
