"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Package, FolderKanban, Warehouse, ShoppingBag, Users, Tags, NotebookPen, Image, Sparkles, BarChart3, Settings, ChevronsLeft, ChevronsRight, Menu, X } from 'lucide-react';
import clsx from 'clsx';

const navGroups = [
  {
    label: 'Sell',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/discounts', label: 'Discounts', icon: Tags },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Catalog', icon: Package },
      { href: '/collections', label: 'Collections', icon: FolderKanban },
      { href: '/inventory', label: 'Inventory', icon: Warehouse },
      { href: '/media', label: 'Media', icon: Image },
    ],
  },
  {
    label: 'Create',
    items: [
      { href: '/blogs', label: 'Content', icon: NotebookPen },
      { href: '/ai', label: 'AI Studio', icon: Sparkles },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      <button
        type="button"
        className="button icon-button sidebar-fab"
        aria-label="Toggle navigation"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <aside className={clsx('sidebar', collapsed && 'sidebar-collapsed', mobileOpen && 'sidebar-open')}>
        <div className="brand">
          <span className="brand-sub">YORD INDIA</span>
          {!collapsed && <span className="brand-title">Control Room</span>}
        </div>
        <nav className="nav-groups">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-section">
              {!collapsed && <div className="nav-section-label">{group.label}</div>}
              <div className="nav-group">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      className={clsx('nav-link', isActive(item.href) && 'active')}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={18} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <div className="helper">Netlify-ready · Supabase-native</div>}
          <button
            type="button"
            className="button icon-button sidebar-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
