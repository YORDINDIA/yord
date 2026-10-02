'use client';

import Link from 'next/link';
import { Package, Heart, Settings, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
    description: 'Items you\'ve saved for later',
  },
  {
    href: '/account/settings',
    icon: Settings,
    title: 'Settings',
    description: 'Update your account details',
  },
];

export default function AccountPage() {
  const { user } = useAuth();

  // Get user name from metadata
  const userName = user?.user_metadata?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email?.split('@')[0] ||
    'there';

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-surface-card border border-border-default p-8">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl text-text-primary mb-2">
          Welcome, {userName}!
        </h2>
        <p className="font-[family-name:var(--font-jakarta)] text-text-muted">
          Manage your account, track orders, and update your preferences.
        </p>
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
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <h3 className="font-[family-name:var(--font-bebas)] text-lg tracking-wider text-text-secondary mb-1">
                {link.title}
              </h3>
              <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted">
                {link.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent Orders Preview */}
      <div className="bg-surface-card border border-border-default">
        <div className="p-6 border-b border-border-default flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-playfair)] text-xl text-text-secondary">
            Recent Orders
          </h3>
          <Link
            href="/account/orders"
            className="font-[family-name:var(--font-jakarta)] text-sm text-accent hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="p-6">
          <p className="font-[family-name:var(--font-jakarta)] text-sm text-text-muted text-center py-8">
            No orders yet. Start shopping to see your orders here.
          </p>
          <div className="text-center">
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-accent text-text-on-accent font-[family-name:var(--font-bebas)] text-sm tracking-[0.1em] hover:bg-accent-hover transition-colors"
            >
              SHOP NOW
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
