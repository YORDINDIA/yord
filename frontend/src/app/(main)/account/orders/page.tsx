'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn, formatDate, formatPrice } from '@yord/ui';
import { useAuth } from '@/hooks/useAuth';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { ErrorState } from '@/features/ui/ErrorState';
import { Skeleton } from '@/features/ui/Skeleton';
import { AccountPageHeader } from '../_components/AccountPageHeader';
import {
  fetchAccountOrders,
  financialStatusLabel,
  fulfillmentStatusLabel,
  type AccountOrder,
} from './_lib/orders';

const STATUS_TONES = {
  success: 'text-success bg-success/10',
  danger: 'text-danger bg-danger/10',
  muted: 'text-text-muted bg-surface-inset',
} as const;

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  // `null` = not loaded yet. Three outcomes, kept apart: a failed read must
  // never render as "no orders".
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const email = user?.email ?? null;

  useEffect(() => {
    // Nothing to read until the session resolves — and a signed-out visitor
    // must not be left on the skeleton forever.
    if (!email) return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAccountOrders(email, 20);
        if (cancelled) return;
        setOrders(rows);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, attempt]);

  // Derived, not stored: no synchronous `setState` in the effect body, which
  // is both a lint rule here and one less render.
  const pending = authLoading || (email !== null && orders === null);
  const status: 'loading' | 'ready' | 'error' = failed ? 'error' : pending ? 'loading' : 'ready';
  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      <AccountPageHeader title="Order History" />

      {status === 'loading' ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="text-block" />
          ))}
        </div>
      ) : status === 'error' ? (
        <ErrorState
          as="h2"
          title="We could not load your orders"
          message="Something went wrong while fetching your order history. Try again in a moment."
          onRetry={() => {
            setFailed(false);
            setOrders(null);
            setAttempt((current) => current + 1);
          }}
          showHomeLink={false}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="When you place an order, it will appear here."
        >
          <CtaLink href="/">Start shopping</CtaLink>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((order) => {
            const financial = financialStatusLabel(order.financial_status);
            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block bg-surface-card border border-border-default p-6 hover:border-accent/30 transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-accent text-lg tracking-wider text-text-secondary">
                        #{order.order_number ?? order.id}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-body rounded',
                          STATUS_TONES[financial.tone]
                        )}
                      >
                        {financial.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 font-body text-sm text-text-muted">
                      <span>{formatDate(order.created_at)}</span>
                      <span aria-hidden="true" className="w-1 h-1 bg-text-muted rounded-full" />
                      <span>{fulfillmentStatusLabel(order.fulfillment_status)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-accent text-xl text-accent">
                      {formatPrice(order.total_price, order.currency || 'INR')}
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
