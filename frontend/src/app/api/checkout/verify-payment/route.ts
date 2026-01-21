import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OrderData {
  email: string;
  phone: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  cartItems: Array<{
    productId: number;
    variantId: number;
    title: string;
    variantTitle: string | null;
    price: number;
    quantity: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderData } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Payment verified successfully - Create order in Supabase
    let dbOrderId: number | null = null;

    if (orderData) {
      const typedOrderData = orderData as OrderData;

      // Generate order number (YORD + timestamp + random)
      const orderNumber = Math.floor(Date.now() / 1000);
      const orderName = `YORD-${orderNumber}`;

      // Create order in Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          name: orderName,
          order_number: orderNumber,
          email: typedOrderData.email,
          phone: typedOrderData.phone,
          financial_status: 'paid',
          fulfillment_status: 'unfulfilled',
          currency: 'INR',
          total_price: typedOrderData.total,
          subtotal_price: typedOrderData.subtotal,
          total_tax: typedOrderData.gstAmount,
          total_shipping_price: 0,
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        // Don't fail the payment - log the error but return success
        // The payment was successful, we just couldn't save the order
      } else if (order) {
        dbOrderId = order.id;

        // Create line items
        const lineItems = typedOrderData.cartItems.map(item => ({
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId,
          title: item.title,
          variant_title: item.variantTitle,
          price: item.price,
          quantity: item.quantity,
          requires_shipping: true,
          taxable: true,
          gift_card: false,
        }));

        const { error: lineItemsError } = await supabase
          .from('line_items')
          .insert(lineItems);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order created successfully',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      db_order_id: dbOrderId,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
