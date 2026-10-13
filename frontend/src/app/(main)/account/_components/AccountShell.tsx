'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Package, Heart, Settings, LogOut } from 'lucide-react';
import { cn } from '@yord/ui';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/features/ui/Button';
import { Skeleton } from '@/features/ui/Skeleton';

interface AccountShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/settings', label: 'Settings', icon: Settings },
];

/**
 * The interactive half of the account layout: session, sidebar and the
 * `/account/orders/12` active-state rule. It is a separate client component so
 * `layout.tsx` can stay a server component and declare the subtree's metadata —
 * a client component cannot export `metadata`.
 *
 * The landmark is the `(main)` layout's `<main id="main">`; this renders a
 * `<div>`, because a second `<main>` here nested one landmark inside another.
 */
export function AccountShell({ children }: AccountShellProps) {
  const pathname = usePathname();
  const { user, signOut, isLoading } = useAuth();

  // The session resolves client-side (the cookie is read by `useAuth`), so
  // nothing renders until it does: a sidebar painted before the check either
  // flashes a signed-in shell at a signed-out visitor or vanishes a beat later.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-page pt-24 pb-16">
        <div className="container-page">
          <Skeleton variant="text-block" className="max-w-xs mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Skeleton variant="text-block" className="lg:col-span-1" />
            <Skeleton variant="text-block" className="lg:col-span-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-16">
      <div className="container-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-text-primary mb-2">My Account</h1>
          {user?.email ? <p className="font-body text-text-muted">{user.email}</p> : null}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav aria-label="Account" className="bg-surface-card border border-border-default">
              <ul>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  // `/account/orders/12` must keep Orders marked; an exact match
                  // left the whole sidebar unselected on every detail page.
                  const isActive =
                    item.href === '/account'
                      ? pathname === '/account'
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 px-6 py-4 font-body text-sm transition-colors border-b border-border-default last:border-b-0',
                          isActive
                            ? 'text-accent bg-surface-raised/50'
                            : 'text-text-muted hover:text-text-secondary hover:bg-surface-raised/30'
                        )}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => void signOut()}
                    // Matches the nav rows rather than the Bebas button recipe:
                    // it is the last row of the sidebar list, not a page CTA.
                    className="justify-start gap-3 px-6 py-4 font-body text-sm normal-case tracking-normal"
                  >
                    <LogOut size={18} aria-hidden="true" />
                    Sign Out
                  </Button>
                </li>
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
