import type { Metadata } from 'next';

/**
 * `page.tsx` is a client component, so the list's canonical lives here. This
 * layout also wraps `orders/[id]`, which resolves its own canonical and
 * overrides the one below — a static canonical here would point every order
 * detail page at the list. `noindex` comes from `account/layout.tsx`.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/account/orders' },
};

export default function AccountOrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
