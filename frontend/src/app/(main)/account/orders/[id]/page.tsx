import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Package, Truck } from 'lucide-react';
import { cn, formatDate, formatPrice } from '@yord/ui';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/features/ui/EmptyState';
import { AccountPageHeader } from '../../_components/AccountPageHeader';
import { financialStatusLabel, fulfillmentStatusLabel } from '../../orders/_lib/orders';

const STATUS_TONES = {
  success: 'text-success bg-success/10',
  danger: 'text-danger bg-danger/10',
  muted: 'text-text-muted bg-surface-inset',
} as const;

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The canonical is the resolved order URL, not the list's: `orders/layout.tsx`
 * declares `/account/orders` for the list and this page has to override it, or
 * every order detail page would name the list as its canonical.
 */
export async function generateMetadata({ params }: OrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    alternates: { canonical: `/account/orders/${id}` },
  };
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
    currency: string | null;
    created_at: string;
  };
  const currency = o.currency || 'INR';
  const items = (lineItems || []) as {
    id: number;
    title: string;
    variant_title: string | null;
    price: number | string;
    quantity: number;
  }[];

  const financial = financialStatusLabel(o.financial_status);

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary font-body text-sm transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to orders
      </Link>

      <AccountPageHeader
        title={`Order ${o.name}`}
        action={
          <span
            className={cn(
              'inline-block px-2 py-0.5 text-xs font-body rounded',
              STATUS_TONES[financial.tone]
            )}
          >
            {financial.label}
          </span>
        }
      />

      <div className="bg-surface-card border border-border-default p-6 space-y-4">
        <div className="flex items-center gap-3 text-text-muted">
          <Calendar size={18} aria-hidden="true" />
          <span className="font-body text-sm">Ordered on {formatDate(o.created_at)}</span>
        </div>
        <div className="flex items-center gap-3 text-text-muted">
          <Truck size={18} aria-hidden="true" />
          <span className="font-body text-sm">
            Fulfillment: {fulfillmentStatusLabel(o.fulfillment_status)}
          </span>
        </div>
      </div>

      <div className="bg-surface-card border border-border-default p-6">
        <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-4 flex items-center gap-2">
          <Package size={18} aria-hidden="true" /> ITEMS
        </h3>
        {items.length === 0 ? (
          <EmptyState
            as="p"
            title="No line items recorded"
            message="This order has no item rows in our records. Contact support if that looks wrong."
          />
        ) : (
          <ul className="divide-y divide-border-default">
            {items.map((item) => (
              <li key={item.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-sm text-text-secondary">{item.title}</p>
                  {item.variant_title && (
                    <p className="font-body text-xs text-text-muted">
                      {item.variant_title} × {item.quantity}
                    </p>
                  )}
                </div>
                <span className="font-body text-sm text-text-secondary">
                  {formatPrice(Number(item.price) * item.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border-default mt-4 pt-4 flex justify-between items-center">
          <span className="font-body text-text-muted">Total</span>
          <span className="font-heading text-2xl text-text-primary">
            {formatPrice(Number(o.total_price), currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
