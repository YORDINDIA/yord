'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Heart, Package, Settings } from 'lucide-react';
import { formatDate, formatPrice } from '@yord/ui';
import { useAuth } from '@/hooks/useAuth';
import { CtaLink } from '@/features/ui/CtaLink';
import { EmptyState } from '@/features/ui/EmptyState';
import { ErrorState } from '@/features/ui/ErrorState';
import { Skeleton } from '@/features/ui/Skeleton';
import { AccountPageHeader } from './_components/AccountPageHeader';
import { fetchAccountOrders, financialStatusLabel, type AccountOrder } from './orders/_lib/orders';

const QUICK_LINKS = [
  {
    href: '/account/orders',
    icon: Package,
    title: 'Orders',
    description: 'Track and manage your orders',
  },
  {
    href: '/account/wishlist',
    icon: Heart,
    title: 'Wishlist',
    description: "Items you've saved for later",
  },
  {
    href: '/account/settings',
    icon: Settings,
    title: 'Settings',
    description: 'Update your account details',
  },
];

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  // `null` = not loaded yet; a failed read is a separate flag so it can never
  // render as "no orders".
  const [recentOrders, setRecentOrders] = useState<AccountOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const email = user?.email ?? null;

  useEffect(() => {
    if (!email) return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAccountOrders(email, 3);
        if (cancelled) return;
        setRecentOrders(rows);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, attempt]);

  const pending = authLoading || (email !== null && recentOrders === null);
  const status: 'loading' | 'ready' | 'error' = failed ? 'error' : pending ? 'loading' : 'ready';
  const orders = recentOrders ?? [];

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email?.split('@')[0] ||
    'there';

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-surface-card border border-border-default p-8">
        <AccountPageHeader
          title={`Welcome, ${userName}!`}
          description="Manage your account, track orders, and update your preferences."
        />
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group bg-surface-card border border-border-default p-6 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 bg-surface-raised flex items-center justify-center mb-4 group-hover:bg-accent-tint transition-colors">
                  <Icon aria-hidden="true" className="w-6 h-6 text-accent" />
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors"
                />
              </div>
              <h3 className="font-accent text-lg tracking-wider text-text-secondary mb-1">
                {link.title}
              </h3>
              <p className="font-body text-sm text-text-muted">{link.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="bg-surface-card border border-border-default">
        <div className="p-6 border-b border-border-default flex items-center justify-between">
          <h3 className="font-display text-xl text-text-secondary">Recent Orders</h3>
          <Link href="/account/orders" className="font-body text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="p-6">
          {status === 'loading' ? (
            <Skeleton variant="text-block" />
          ) : status === 'error' ? (
            // Never "no orders" for a failed read: that would tell a shopper
            // with a live order that they have none.
            <ErrorState
              as="h2"
              title="We could not load your recent orders"
              message="Your order history is still available on the orders page."
              onRetry={() => {
                setFailed(false);
                setRecentOrders(null);
                setAttempt((current) => current + 1);
              }}
              showHomeLink={false}
            />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              message="Start shopping to see your orders here."
              as="p"
            >
              <CtaLink href="/">Shop now</CtaLink>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border-default">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 py-4 group"
                  >
                    <div>
                      <p className="font-accent text-base tracking-wider text-text-secondary">
                        #{order.order_number ?? order.id}
                      </p>
                      <p className="font-body text-xs text-text-muted mt-1">
                        {formatDate(order.created_at)} ·{' '}
                        {financialStatusLabel(order.financial_status).label}
                      </p>
                    </div>
                    <span className="font-accent text-lg text-accent">
                      {formatPrice(order.total_price, order.currency || 'INR')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
