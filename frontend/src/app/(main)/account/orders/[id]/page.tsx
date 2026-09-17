import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Calendar, Truck } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, formatPrice } from '@/lib/utils';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/login?redirect=' + encodeURIComponent(`/account/orders/${orderId}`));
  }

  // Ownership check: id + authenticated email must match (RLS is the backstop)
  const { data: order } = await supabase
    .from('orders')
    .select('id, name, order_number, email, financial_status, fulfillment_status, total_price, currency, created_at, processed_at')
    .eq('id', orderId)
    .eq('email', user.email)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, title, variant_title, price, quantity')
    .eq('order_id', orderId);

  const o = order as {
    name: string;
    financial_status: string;
    fulfillment_status: string | null;
    total_price: number | string;
    currency: string;
    created_at: string;
  };
  const items = (lineItems || []) as {
    id: number;
    title: string;
    variant_title: string | null;
    price: number | string;
    quantity: number;
  }[];

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-ivory-400 hover:text-ivory-100 font-[family-name:var(--font-jakarta)] text-sm transition-colors"
      >
        <ArrowLeft size={16} />
        Back to orders
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-ivory-50">
          Order {o.name}
        </h2>
        <span className="font-[family-name:var(--font-bebas)] text-sm tracking-wider text-green-400">
          {o.financial_status?.toUpperCase()}
        </span>
      </div>

      <div className="bg-noir-900 border border-noir-800 p-6 space-y-4">
        <div className="flex items-center gap-3 text-ivory-400">
          <Calendar size={18} />
          <span className="font-[family-name:var(--font-jakarta)] text-sm">
            Ordered on{' '}
            {formatDate(o.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-ivory-400">
          <Truck size={18} />
          <span className="font-[family-name:var(--font-jakarta)] text-sm">
            Fulfillment: {o.fulfillment_status?.toUpperCase() || 'PROCESSING'}
          </span>
        </div>
      </div>

      <div className="bg-noir-900 border border-noir-800 p-6">
        <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-ivory-100 mb-4 flex items-center gap-2">
          <Package size={18} /> ITEMS
        </h3>
        {items.length === 0 ? (
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-400">
            No line items recorded for this order.
          </p>
        ) : (
          <ul className="divide-y divide-noir-800">
            {items.map((item) => (
              <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
                    {item.title}
                  </p>
                  {item.variant_title && (
                    <p className="font-[family-name:var(--font-jakarta)] text-xs text-ivory-500">
                      {item.variant_title} × {item.quantity}
                    </p>
                  )}
                </div>
                <span className="font-[family-name:var(--font-jakarta)] text-sm text-ivory-100">
                  {formatPrice(Number(item.price) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-noir-800 mt-4 pt-4 flex justify-between items-center">
          <span className="font-[family-name:var(--font-jakarta)] text-ivory-400">Total</span>
          <span className="font-[family-name:var(--font-cormorant)] text-2xl text-ivory-50">
            {formatPrice(Number(o.total_price))}
          </span>
        </div>
      </div>
    </div>
  );
}
