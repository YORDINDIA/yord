'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Package, Heart, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@yord/ui';

interface AccountLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/settings', label: 'Settings', icon: Settings },
];

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();
  const { user, signOut, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-surface-page pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-surface-raised rounded" />
            <div className="h-64 bg-surface-card rounded" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-page pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl text-text-primary mb-2">
            My Account
          </h1>
          {user?.email && (
            <p className="font-[family-name:var(--font-jakarta)] text-text-muted">
              {user.email}
            </p>
          )}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav className="bg-surface-card border border-border-default">
              <ul>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-6 py-4 font-[family-name:var(--font-jakarta)] text-sm transition-colors border-b border-border-default last:border-b-0',
                          isActive
                            ? 'text-accent bg-surface-raised/50'
                            : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised/30'
                        )}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-6 py-4 font-[family-name:var(--font-jakarta)] text-sm text-text-muted hover:text-red-400 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </main>
  );
}
