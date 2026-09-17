'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Search, Loader2, Check, AlertCircle, MapPin, Calendar, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatPrice, sanitizeOrPattern } from '@/lib/utils';

interface OrderDetails {
  id: number;
  name: string;
  order_number: number;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: number;
  created_at: string;
  processed_at: string | null;
}

export default function TrackOrderPage() {
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const rawNumber = orderNumber.trim().slice(0, 50);
      const numeric = parseInt(rawNumber.replace(/^YORD-/i, ''), 10);
      // Quote the name predicate so input chars cannot break out of the filter
      const safeName = sanitizeOrPattern(rawNumber);

      // Search by order number/name and email
      const { data, error: searchError } = await supabase
        .from('orders')
        .select('id, name, order_number, email, financial_status, fulfillment_status, total_price, created_at, processed_at')
        .eq('email', email.toLowerCase().trim())
        .or(`name.eq."${safeName}",order_number.eq.${Number.isFinite(numeric) ? numeric : 0}`)
        .single();

      if (searchError || !data) {
        setError('Order not found. Please check your order number and email address.');
        return;
      }

      setOrder(data);
    } catch (err) {
      setError('Failed to find order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'fulfilled':
        return 'text-green-500';
      case 'pending':
      case 'unfulfilled':
        return 'text-amber-500';
      case 'cancelled':
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-ivory-400';
    }
  };

  return (
    <main className="min-h-screen bg-noir-950 pt-24 pb-16">
      <div className="max-w-2xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 mx-auto mb-6 bg-gold-200/10 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-gold-200" />
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl text-ivory-50 mb-4">
            Track Your Order
          </h1>
          <p className="font-[family-name:var(--font-jakarta)] text-ivory-400">
            Enter your order number and email to track your delivery.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="bg-noir-900 border border-noir-800 p-8 mb-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-2">
                ORDER NUMBER
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                required
                placeholder="e.g., YORD-1234567890"
                className="w-full h-12 px-4 bg-noir-800 border border-noir-700 text-ivory-50 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none focus:border-gold-200"
              />
            </div>

            <div>
              <label className="block font-[family-name:var(--font-bebas)] text-xs tracking-[0.1em] text-ivory-400 mb-2">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="The email used for your order"
                className="w-full h-12 px-4 bg-noir-800 border border-noir-700 text-ivory-50 font-[family-name:var(--font-jakarta)] placeholder:text-ivory-500 focus:outline-none focus:border-gold-200"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 flex items-center justify-center gap-2 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  SEARCHING...
                </>
              ) : (
                <>
                  <Search size={18} />
                  TRACK ORDER
                </>
              )}
            </button>
          </div>
        </form>

        {/* Order Details */}
        {order && (
          <div className="bg-noir-900 border border-noir-800 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-[family-name:var(--font-bebas)] text-xl tracking-wider text-ivory-100">
                ORDER {order.name}
              </h2>
              <span className={`font-[family-name:var(--font-bebas)] text-sm tracking-wider ${getStatusColor(order.financial_status)}`}>
                {order.financial_status?.toUpperCase() || 'PENDING'}
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-ivory-400">
                <Calendar size={18} />
                <span className="font-[family-name:var(--font-jakarta)] text-sm">
                  Ordered on {formatDate(order.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-ivory-400">
                <Truck size={18} />
                <span className="font-[family-name:var(--font-jakarta)] text-sm">
                  Fulfillment: <span className={getStatusColor(order.fulfillment_status)}>
                    {order.fulfillment_status?.toUpperCase() || 'PROCESSING'}
                  </span>
                </span>
              </div>
            </div>

            <div className="border-t border-noir-800 pt-6">
              <div className="flex justify-between items-center">
                <span className="font-[family-name:var(--font-jakarta)] text-ivory-400">Total</span>
                <span className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50">
                  {formatPrice(order.total_price)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-4">
            Can&apos;t find your order or need help?
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 border border-ivory-600 text-ivory-300 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:border-gold-200 hover:text-gold-200 transition-colors"
          >
            CONTACT SUPPORT
          </Link>
        </div>
      </div>
    </main>
  );
}
