'use client';

import { useState, useCallback } from 'react';
import {
  loadRazorpayScript,
  createRazorpayCheckout,
  RazorpayPaymentResponse,
  RazorpayCheckoutOptions,
} from '@/lib/razorpay/client';
import type { CartItem } from '@/types/database';

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
            try {
              // Verify payment and create order on server (30s timeout so a
              // hung verify never leaves the checkout promise pending forever)
              const verifyResponse = await fetch('/api/checkout/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                }),
                signal: AbortSignal.timeout(30000),
              });

              if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.error || 'Payment verification failed');
              }

              const verifyData = await verifyResponse.json();
              resolve({ ...response, order_name: verifyData.order_name });
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
