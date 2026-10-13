import {
  BarChart3,
  FolderKanban,
  Image as ImageIcon,
  LayoutDashboard,
  NotebookPen,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/**
 * The admin's navigation map — one entry per top-level section.
 *
 * This is the single source for the sidebar, the breadcrumb labels, the page
 * headers, and the per-section accent hue (`data-section` in globals.css maps
 * each key to a palette colour through `--accent-local`).
 *
 * It is deliberately data-only (no Supabase, no server imports) so the client
 * sidebar and server-rendered pages can both read it.
 */

export type SectionKey =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'discounts'
  | 'products'
  | 'collections'
  | 'inventory'
  | 'media'
  | 'blogs'
  | 'ai'
  | 'analytics'
  | 'settings';

export interface SectionMeta {
  key: SectionKey;
  label: string;
  /** Short label for tight spaces (breadcrumbs, tabs). */
  short: string;
  href: string;
  icon: LucideIcon;
  /** One line used as the default page-header description. */
  description: string;
}

export const SECTIONS: Record<SectionKey, SectionMeta> = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    short: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Revenue, orders, and stock at a glance.',
  },
  orders: {
    key: 'orders',
    label: 'Orders',
    short: 'Orders',
    href: '/orders',
    icon: ShoppingBag,
    description: 'Payment, fulfillment, and refunds.',
  },
  customers: {
    key: 'customers',
    label: 'Customers',
    short: 'Customers',
    href: '/customers',
    icon: Users,
    description: 'Buyers, spend, and contact history.',
  },
  discounts: {
    key: 'discounts',
    label: 'Discounts',
    short: 'Discounts',
    href: '/discounts',
    icon: Tags,
    description: 'Price rules and coupon codes.',
  },
  products: {
    key: 'products',
    label: 'Catalog',
    short: 'Catalog',
    href: '/products',
    icon: Package,
    description: 'Products, variants, pricing, and media.',
  },
  collections: {
    key: 'collections',
    label: 'Collections',
    short: 'Collections',
    href: '/collections',
    icon: FolderKanban,
    description: 'Manual and smart merchandising groups.',
  },
  inventory: {
    key: 'inventory',
    label: 'Inventory',
    short: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    description: 'Stock levels and fulfillment points.',
  },
  media: {
    key: 'media',
    label: 'Media',
    short: 'Media',
    href: '/media',
    icon: ImageIcon,
    description: 'Uploads, product images, and article covers.',
  },
  blogs: {
    key: 'blogs',
    label: 'Content',
    short: 'Content',
    href: '/blogs',
    icon: NotebookPen,
    description: 'Blogs, articles, and publishing.',
  },
  ai: {
    key: 'ai',
    label: 'AI Studio',
    short: 'AI',
    href: '/ai',
    icon: Sparkles,
    description: 'Listing, blog, and campaign generation.',
  },
  analytics: {
    key: 'analytics',
    label: 'Analytics',
    short: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Revenue trends and product performance.',
  },
  settings: {
    key: 'settings',
    label: 'Settings',
    short: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Admin access and the audit log.',
  },
};

/** Sidebar order, grouped the way the work flows. */
export const SECTION_GROUPS: { label: string; keys: SectionKey[] }[] = [
  { label: 'Sell', keys: ['dashboard', 'orders', 'customers', 'discounts'] },
  { label: 'Catalog', keys: ['products', 'collections', 'inventory', 'media'] },
  { label: 'Create', keys: ['blogs', 'ai'] },
  { label: 'System', keys: ['analytics', 'settings'] },
];

/** Every section key, in sidebar order. */
export const SECTION_ORDER: SectionKey[] = SECTION_GROUPS.flatMap((group) => group.keys);

/**
 * Resolve a pathname to its section.
 *
 * `/articles/*` belongs to the Content section (articles live under blogs) and
 * `/` redirects to the dashboard. Unknown paths fall back to the dashboard so
 * the shell always has a hue.
 */
export function sectionKeyForPath(pathname: string | null | undefined): SectionKey {
  const segment = (pathname ?? '/').split('/').filter(Boolean)[0] ?? 'dashboard';
  if (segment === 'articles') return 'blogs';
  return (SECTION_ORDER as string[]).includes(segment) ? (segment as SectionKey) : 'dashboard';
}

/** Resolve a pathname to its full section metadata. */
export function sectionForPath(pathname: string | null | undefined): SectionMeta {
  return SECTIONS[sectionKeyForPath(pathname)];
}
