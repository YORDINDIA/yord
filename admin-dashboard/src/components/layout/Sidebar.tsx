"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Boxes, ShoppingBag, Users, Tags, NotebookPen, Image, Sparkles, BarChart3, Settings } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Catalog', icon: Package },
  { href: '/collections', label: 'Collections', icon: Boxes },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/discounts', label: 'Discounts', icon: Tags },
  { href: '/blogs', label: 'Content', icon: NotebookPen },
  { href: '/media', label: 'Media', icon: Image },
  { href: '/ai', label: 'AI Studio', icon: Sparkles },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-sub">YORD INDIA</span>
        <span className="brand-title">Control Room</span>
      </div>
      <nav className="nav-group">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              className={clsx('nav-link', active && 'active')}
              href={item.href}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="helper">Netlify-ready · Supabase-native</div>
    </aside>
  );
}
