'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ChevronRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatDate, formatPrice } from '@/lib/utils';

interface Order {
  id: number;
  order_number: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: number;
  currency: string;
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.email) {
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, financial_status, fulfillment_status, total_price, currency')
        .eq('email', user.email)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setOrders(data);
      }
      setIsLoading(false);
    };

    fetchOrders();
  }, [user?.email]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'text-green-400 bg-green-500/10';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'refunded':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-ivory-400 bg-ivory-500/10';
    }
  };

  const getFulfillmentStatus = (status: string | null) => {
    if (!status) return 'Processing';
    switch (status.toLowerCase()) {
      case 'fulfilled':
        return 'Delivered';
      case 'partial':
        return 'Partially Shipped';
      default:
        return 'Processing';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-gold-200 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50">
          Order History
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="bg-noir-900 border border-noir-800 p-12 text-center">
          <div className="w-16 h-16 bg-noir-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8 text-ivory-500" />
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-xl text-ivory-100 mb-2">
            No orders yet
          </h3>
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400 mb-6">
            When you place an order, it will appear here.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-gold-200 text-noir-950 font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-gold-300 transition-colors"
          >
            START SHOPPING
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block bg-noir-900 border border-noir-800 p-6 hover:border-gold-200/30 transition-colors group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100">
                      {order.order_number}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 text-xs font-[family-name:var(--font-jakarta)] rounded',
                      getStatusColor(order.financial_status)
                    )}>
                      {order.financial_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
                    <span>{formatDate(order.created_at)}</span>
                    <span className="w-1 h-1 bg-ivory-600 rounded-full" />
                    <span>{getFulfillmentStatus(order.fulfillment_status)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-[family-name:var(--font-bebas)] text-xl text-gold-200">
                    {formatPrice(order.total_price, order.currency)}
                  </span>
                  <ChevronRight className="w-5 h-5 text-ivory-500 group-hover:text-gold-200 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
